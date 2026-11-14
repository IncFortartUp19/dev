from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from campus_api.db import bind_actor

def test_owner_only_private_drafts_and_resume(api):
    first = api.request("POST", "/idea-drafts", "alice", json={
        "question": "Què necessita el barri?",
    })
    assert first.status_code == 201, first.text
    item = first.json()
    assert item["visibility"] == "private"
    assert item["intention"] == item["next_test"] == item["name"] == ""
    draft_id = item["id"]
    assert [row["id"] for row in api.request("GET", "/idea-drafts", "alice").json()] == [draft_id]
    assert api.request("GET", f"/idea-drafts/{draft_id}", "bob").status_code == 404
    denied = api.request(
        "POST", f"/idea-drafts/{draft_id}", "bob", json={"question": "Robar"}
    )
    assert denied.status_code == 404
    assert api.request("GET", "/idea-drafts", "bob").json() == []
    changed = api.request("POST", f"/idea-drafts/{draft_id}", "alice", json={
        "question": "Què necessita el barri?", "intention": "Entendre els usos"
    })
    assert changed.status_code == 200
    assert changed.json()["intention"] == "Entendre els usos"
    resumed = api.request("GET", f"/idea-drafts/{draft_id}", "alice").json()
    assert resumed["next_test"] == ""
    assert api.request("GET", f"/idea-drafts/{uuid4()}", "alice").status_code == 404

def test_drafts_reject_unauthenticated_overposting_and_invalid_input(api):
    assert api.client.get("/v1/idea-drafts").status_code == 401
    for payload in (
        {"question": ""},
        {"question": "Una prova", "visibility": "public"},
        {"question": "Una prova", "owner_id": str(uuid4())},
        {"question": "X" * 2001},
    ):
        assert api.request("POST", "/idea-drafts", "alice", json=payload).status_code == 422
    response = api.request("GET", "/idea-drafts", "alice")
    assert response.headers["cache-control"] == "no-store"

def test_draft_rls_is_forced(api):
    if api.app.state.engine.dialect.name != "postgresql":
        return
    with api.app.state.engine.connect() as conn:
        flags = conn.execute(
            text("SELECT relrowsecurity, relforcerowsecurity "
                 "FROM pg_class WHERE relname='idea_drafts'")
        ).one()
        assert flags == (True, True)

def test_drafts_respect_signed_oidc(signed_api):
    api, mint = signed_api
    response = api.client.post(
        "/v1/idea-drafts",
        json={"question": "Idea signada"},
        headers={"Authorization": "Bearer " + mint()},
    )
    assert response.status_code == 201, response.text
    no_token = api.client.get("/v1/idea-drafts")
    assert no_token.status_code == 401


def test_postgres_rls_filters_sql_and_rejects_forged_owner(protected_api):
    import re

    api, limited, admin = protected_api
    with limited.connect() as conn:
        role = conn.scalar(text("SELECT current_user"))
    assert re.fullmatch(r"rls_test_[0-9a-f]{32}", role)
    with admin.begin() as conn:
        conn.execute(text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON idea_drafts TO {role}"))

    alice = api.request("GET", "/me", "alice").json()["id"]
    bob = api.request("GET", "/me", "bob").json()["id"]
    created = api.request("POST", "/idea-drafts", "alice", json={"question": "Pregunta privada"})
    assert created.status_code == 201, created.text
    draft_id = created.json()["id"]
    with Session(limited) as db:
        assert db.execute(text("SELECT id FROM idea_drafts")).all() == []
        bind_actor(db, bob)
        assert db.execute(text("SELECT id FROM idea_drafts")).all() == []
        assert db.execute(
            text("UPDATE idea_drafts SET question='No autoritzat' WHERE id=:id"),
            {"id": draft_id},
        ).rowcount == 0
        db.rollback()
    with Session(limited) as db:
        bind_actor(db, bob)
        with pytest.raises(DBAPIError):
            db.execute(
                text("INSERT INTO idea_drafts "
                     "(id, owner_id, question, intention, next_test, name, visibility, updated_at) "
                     "VALUES (:id, :owner, 'Falsificat', '', '', '', "
                     "'private', CURRENT_TIMESTAMP)"),
                {"id": str(uuid4()), "owner": alice},
            )
        db.rollback()
    with Session(limited) as db:
        bind_actor(db, alice)
        assert db.execute(text("SELECT id FROM idea_drafts")).scalars().all() == [draft_id]
