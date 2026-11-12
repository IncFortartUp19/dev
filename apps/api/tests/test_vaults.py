from uuid import uuid4

from alembic import command
from sqlalchemy import text

from tests.conftest import migration_config


def vault(api, actor="founder", name="Projecte privat"):
    response = api.request("POST", "/vaults", actor, json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_private_projects_have_independent_memberships_and_hidden_existence(api):
    a = vault(api)
    b = vault(api, "other-founder", "Un altre projecte")
    # Being a Campus teacher, or owning another private project, confers no access.
    api.space()
    for outsider in ("teacher", "other-founder", "student"):
        for endpoint in (f"/vaults/{a}", f"/vaults/{a}/members", f"/vaults/{a}/events"):
            denied = api.request("GET", endpoint, outsider)
            missing = api.request("GET", endpoint.replace(a, str(uuid4())), outsider)
            assert denied.status_code == missing.status_code == 404
            assert denied.json() == missing.json()
        assert (
            api.request(
                "POST",
                f"/vaults/{a}/members",
                outsider,
                json={"user_id": str(uuid4()), "role": "reader"},
            ).status_code
            == 404
        )
    assert [v["id"] for v in api.request("GET", "/vaults", "founder").json()] == [a]
    assert [v["id"] for v in api.request("GET", "/vaults", "other-founder").json()] == [b]
    assert api.request("GET", "/vaults", "teacher").json() == []


def test_owner_grants_only_one_project_and_revocation_blocks_existing_account(api):
    a = vault(api)
    b = vault(api)
    guest = api.request("GET", "/me", "guest").json()["id"]
    owner = api.request("GET", "/me", "founder").json()["id"]
    grant = {"user_id": guest, "role": "reader"}
    assert api.request("POST", f"/vaults/{a}/members", "founder", json=grant).status_code == 201
    assert api.request("GET", f"/vaults/{a}", "guest").json()["role"] == "reader"
    assert api.request("GET", f"/vaults/{b}", "guest").status_code == 404
    assert api.request("GET", f"/vaults/{a}/members", "guest").status_code == 403
    assert api.request("GET", f"/vaults/{a}/events", "guest").status_code == 403
    assert (
        api.request(
            "POST", f"/vaults/{a}/members", "guest", json={"user_id": guest, "role": "contributor"}
        ).status_code
        == 403
    )
    assert api.request("DELETE", f"/vaults/{a}/members/{owner}", "founder").status_code == 409
    assert api.request("DELETE", f"/vaults/{a}/members/{guest}", "guest").status_code == 403
    assert api.request("DELETE", f"/vaults/{a}/members/{guest}", "founder").status_code == 204
    assert api.request("GET", f"/vaults/{a}", "guest").status_code == 404
    assert api.request("GET", "/vaults", "guest").json() == []
    events = api.request("GET", f"/vaults/{a}/events", "founder").json()
    assert [e["action"] for e in events] == [
        "project.created",
        "member.granted.reader",
        "member.revoked",
    ]
    assert len(api.request("GET", f"/vaults/{b}/events", "founder").json()) == 1
    assert all(set(e) == {"id", "actor_id", "action", "target_id", "occurred_at"} for e in events)


def test_vaults_reject_overposting_and_implicit_owner_roles(api):
    a = vault(api)
    guest = api.request("GET", "/me", "guest").json()["id"]
    for payload in (
        {"user_id": guest, "role": "owner"},
        {"user_id": guest, "role": "reader", "vault_id": a},
        {"email": "guest@example.org", "role": "reader"},
    ):
        assert (
            api.request("POST", f"/vaults/{a}/members", "founder", json=payload).status_code == 422
        )
    assert (
        api.request(
            "POST", "/vaults", "founder", json={"name": "Projecte", "created_by": guest}
        ).status_code
        == 422
    )
    assert (
        api.request(
            "POST",
            f"/vaults/{a}/members",
            "founder",
            json={"user_id": str(uuid4()), "role": "reader"},
        ).status_code
        == 400
    )
    assert api.client.get("/v1/vaults").status_code == 401
    for response in (
        api.request("GET", f"/vaults/{a}", "founder"),
        api.request("GET", f"/vaults/{a}", "guest"),
        api.client.get("/v1/vaults"),
    ):
        assert response.headers["cache-control"] == "no-store"


def test_rls_migration_backfills_existing_project_relations(api):
    project = vault(api)
    owner = api.request("GET", "/me", "founder").json()["id"]
    guest = api.request("GET", "/me", "guest").json()["id"]
    assert (
        api.request(
            "POST",
            f"/vaults/{project}/members",
            "founder",
            json={"user_id": guest, "role": "reader"},
        ).status_code
        == 201
    )
    config = migration_config(api.settings)
    command.downgrade(config, "0002")
    command.upgrade(config, "head")
    with api.app.state.engine.connect() as conn:
        for table in ("vault_memberships", "vault_events"):
            owners = conn.scalars(
                text(f"SELECT owner_id FROM {table} WHERE vault_id=:id"), {"id": project}
            ).all()
            assert owners and set(owners) == {owner}
    assert api.request("GET", f"/vaults/{project}", "guest").json()["role"] == "reader"
