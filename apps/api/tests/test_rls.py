"""Real PostgreSQL policies, deliberately using an unprivileged database role."""

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from campus_api.database_security import verify_runtime_database
from campus_api.db import bind_actor


def create(api, actor):
    response = api.request("POST", "/vaults", actor, json={"name": actor})
    assert response.status_code == 201, response.text
    user = api.request("GET", "/me", actor).json()["id"]
    return response.json()["id"], user


def test_rls_filters_unscoped_sql_and_resets_context_after_commit_and_pool_reuse(protected_api):
    api, engine, admin = protected_api
    a, alice = create(api, "alice")
    b, bob = create(api, "bob")
    verify_runtime_database(engine)
    with pytest.raises(RuntimeError):
        verify_runtime_database(admin)
    with Session(engine) as db:
        for table in ("project_vaults", "vault_memberships", "vault_events"):
            assert db.execute(text(f"SELECT * FROM {table}")).all() == []
        bind_actor(db, alice)
        assert db.scalars(text("SELECT id FROM project_vaults")).all() == [a]
        assert db.scalars(text("SELECT user_id FROM vault_memberships")).all() == [alice]
        db.commit()
        # The same authenticated SQLAlchemy session rebinds its actor per transaction.
        assert db.scalars(text("SELECT id FROM project_vaults")).all() == [a]
    # A new session borrowing the connection has no previous actor.
    with Session(engine) as db:
        assert db.scalars(text("SELECT id FROM project_vaults")).all() == []
        bind_actor(db, bob)
        assert db.scalars(text("SELECT id FROM project_vaults")).all() == [b]
        db.rollback()
    with Session(engine) as db:
        assert db.scalars(text("SELECT id FROM project_vaults")).all() == []


def test_rls_denies_cross_project_writes_and_forged_ownership(protected_api):
    api, engine, _admin = protected_api
    a, alice = create(api, "alice")
    b, bob = create(api, "bob")
    for table, values in (
        (
            "vault_memberships",
            {"vault_id": b, "owner_id": alice, "user_id": alice, "role": "reader"},
        ),
        ("vault_memberships", {"vault_id": b, "owner_id": bob, "user_id": alice, "role": "reader"}),
        (
            "vault_events",
            {
                "id": str(uuid4()),
                "vault_id": b,
                "owner_id": bob,
                "actor_id": alice,
                "action": "forged",
                "target_id": b,
                "occurred_at": "2026-11-12T00:00:00Z",
            },
        ),
    ):
        with Session(engine) as db:
            bind_actor(db, alice)
            columns = ", ".join(values)
            parameters = ", ".join(f":{key}" for key in values)
            with pytest.raises(DBAPIError):
                db.execute(text(f"INSERT INTO {table} ({columns}) VALUES ({parameters})"), values)
            db.rollback()
    with Session(engine) as db:
        bind_actor(db, alice)
        assert (
            db.execute(
                text("UPDATE project_vaults SET created_by=:actor"), {"actor": alice}
            ).rowcount
            == 0
        )
        assert db.execute(text("UPDATE vault_memberships SET role='owner'")).rowcount == 0
        assert db.execute(text("DELETE FROM vault_events")).rowcount == 0
        assert (
            db.execute(
                text("DELETE FROM vault_memberships WHERE vault_id=:vault"), {"vault": a}
            ).rowcount
            == 0
        )
        db.rollback()


def test_rls_membership_and_revocation_work_with_a_live_account(protected_api):
    api, engine, _admin = protected_api
    a, alice = create(api, "alice")
    b, bob = create(api, "bob")
    response = api.request(
        "POST", f"/vaults/{a}/members", "alice", json={"user_id": bob, "role": "reader"}
    )
    assert response.status_code == 201, response.text
    assert api.request("GET", f"/vaults/{a}", "bob").status_code == 200
    with Session(engine) as db:
        bind_actor(db, bob)
        assert set(db.scalars(text("SELECT id FROM project_vaults"))) == {a, b}
        # Members see only their own membership, never the roster of another owner.
        assert set(db.scalars(text("SELECT user_id FROM vault_memberships"))) == {bob}
        assert set(db.scalars(text("SELECT vault_id FROM vault_events"))) == {b}
    assert api.request("DELETE", f"/vaults/{a}/members/{bob}", "alice").status_code == 204
    assert api.request("GET", f"/vaults/{a}", "bob").status_code == 404
    with Session(engine) as db:
        bind_actor(db, bob)
        assert db.scalars(text("SELECT id FROM project_vaults")).all() == [b]
