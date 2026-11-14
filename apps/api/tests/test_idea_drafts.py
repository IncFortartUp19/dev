from uuid import uuid4
from sqlalchemy import text

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
    assert api.request("POST", f"/idea-drafts/{draft_id}", "bob", json={"question": "Robar"}).status_code == 404
    assert api.request("GET", "/idea-drafts", "bob").json() == []
    changed = api.request("POST", f"/idea-drafts/{draft_id}", "alice", json={
        "question": "Què necessita el barri?", "intention": "Entendre els usos"
    })
    assert changed.status_code == 200
    assert changed.json()["intention"] == "Entendre els usos"
    assert api.request("GET", f"/idea-drafts/{draft_id}", "alice").json()["next_test"] == ""
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
        assert conn.execute(text("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='idea_drafts'")).one() == (True, True)

def test_drafts_respect_signed_oidc(signed_api):
    api, mint = signed_api
    response = api.client.post("/v1/idea-drafts", json={"question": "Idea signada"}, headers={"Authorization": "Bearer " + mint()})
    assert response.status_code == 201, response.text
    no_token = api.client.get("/v1/idea-drafts")
    assert no_token.status_code == 401
