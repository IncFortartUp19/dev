import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from campus_api.auth import get_principal
from campus_api.db import Base
from campus_api.main import create_app
from campus_api.models import AuditEvent, Invitation, SpaceMembership, User, now
from tests.conftest import test_principal as principal_override


def test_space_membership_is_scoped_and_untrusted_role_is_rejected(api):
    space = api.space()
    assert space["role"] == "teacher"
    assert api.request("GET", "/spaces", "alice").json() == []
    api.enroll(space["id"])
    assert api.request("GET", "/spaces", "alice").json()[0]["role"] == "student"
    assert api.request("POST", f"/spaces/{space['id']}/invitations", "alice").status_code == 403
    own_space = api.space("alice")
    assert own_space["role"] == "teacher"
    assert api.request("POST", f"/spaces/{space['id']}/invitations", "alice").status_code == 403
    assert (
        api.request(
            "POST",
            "/spaces",
            "alice",
            json={
                "title": "Test",
                "subject": "Test",
                "role": "teacher",
            },
        ).status_code
        == 422
    )


def test_invitation_hash_single_use_expiration_and_revocation(api):
    space = api.space()
    invitation = api.request("POST", f"/spaces/{space['id']}/invitations").json()
    with Session(api.app.state.engine) as db:
        saved = db.get(Invitation, invitation["id"])
        assert saved.token_hash == hashlib.sha256(invitation["token"].encode()).hexdigest()
        assert saved.token_hash != invitation["token"]
    result = api.request(
        "POST", "/invitations/accept", "alice", json={"token": invitation["token"]}
    )
    assert result.status_code == 200
    assert (
        api.request(
            "POST",
            "/invitations/accept",
            "bob",
            json={
                "token": invitation["token"],
            },
        ).status_code
        == 404
    )
    assert api.request("GET", "/spaces", "bob").json() == []
    expired = api.request("POST", f"/spaces/{space['id']}/invitations").json()
    with Session(api.app.state.engine) as db:
        db.get(Invitation, expired["id"]).expires_at = now() - timedelta(hours=1)
        db.commit()
    assert (
        api.request(
            "POST",
            "/invitations/accept",
            "bob",
            json={
                "token": expired["token"],
            },
        ).status_code
        == 404
    )
    revoked = api.request("POST", f"/spaces/{space['id']}/invitations").json()
    assert api.request("DELETE", f"/invitations/{revoked['id']}", "bob").status_code == 404
    assert api.request("DELETE", f"/invitations/{revoked['id']}").status_code == 204
    assert (
        api.request(
            "POST",
            "/invitations/accept",
            "bob",
            json={
                "token": revoked["token"],
            },
        ).status_code
        == 404
    )
    with Session(api.app.state.engine) as db:
        bob = db.scalar(select(User).where(User.display_name == "bob"))
        assert db.get(SpaceMembership, (space["id"], bob.id)) is None
        events = db.scalars(select(AuditEvent)).all()
        assert all(invitation["token"] not in event.action for event in events)


def test_team_invitation_does_not_grant_course_access(api):
    space, team, project = api.project()
    invite = api.request("POST", f"/teams/{team['id']}/invitations", "alice").json()
    assert (
        api.request(
            "POST",
            "/invitations/accept",
            "bob",
            json={
                "token": invite["token"],
            },
        ).status_code
        == 403
    )
    api.enroll(space["id"], "bob")
    assert api.request("GET", f"/projects/{project['id']}", "bob").status_code == 404
    assert (
        api.request(
            "POST",
            "/invitations/accept",
            "bob",
            json={
                "token": invite["token"],
            },
        ).status_code
        == 200
    )
    assert api.request("GET", f"/projects/{project['id']}", "bob").status_code == 200


def test_projects_are_private_to_team_and_course_teacher(api):
    space, team, project = api.project()
    api.enroll(space["id"], "bob")
    bob_team = api.request("POST", f"/spaces/{space['id']}/teams", "bob", json={"name": "Altres"})
    assert bob_team.status_code == 201
    api.space("outsider")  # A teacher elsewhere has no access here.
    for actor in ("bob", "outsider"):
        assert api.request("GET", f"/projects/{project['id']}", actor).status_code == 404
        assert (
            api.request(
                "POST",
                f"/teams/{team['id']}/projects",
                actor,
                json={
                    "title": "Inaccessible",
                    "description": "No pertanyem a aquest equip del campus.",
                    "category": "Test",
                },
            ).status_code
            == 404
        )
    assert api.request("GET", f"/spaces/{space['id']}/projects", "bob").json() == []
    assert api.request("GET", f"/spaces/{space['id']}/teams", "bob").json() == [bob_team.json()]
    assert api.request("GET", f"/spaces/{space['id']}/projects", "outsider").status_code == 404
    assert api.request("GET", f"/spaces/{space['id']}/projects").json() == [project]
    assert api.request("GET", f"/projects/{project['id']}").status_code == 200
    assert (
        api.request(
            "POST",
            f"/projects/{project['id']}/submissions",
            json={
                "note": "El professor no presenta treballs en nom de l’equip.",
            },
        ).status_code
        == 404
    )


def test_submissions_preserve_feedback_and_server_calculates_grade(api):
    space, _team, project = api.project()
    url = f"/projects/{project['id']}/submissions"
    first = api.request("POST", url, "alice", json={"note": "Primera proposta del projecte."})
    assert first.status_code == 201, first.text
    assert first.json()["version_number"] == 1
    review_url = f"/submissions/{first.json()['id']}/reviews"
    review = {"scores": [8, 7, 6, 8], "feedback": "Concreteu pressupost i indicadors."}
    assert api.request("POST", review_url, "alice", json=review).status_code == 403
    api.space("outsider")
    assert api.request("POST", review_url, "outsider", json=review).status_code == 404
    assert (
        api.request("POST", review_url, json={**review, "scores": [11, 7, 6, 8]}).status_code == 422
    )
    assert api.request("POST", review_url, json={**review, "total": 10}).status_code == 422
    published = api.request("POST", review_url, json=review)
    assert published.status_code == 201, published.text
    assert published.json()["total"] == 7.2
    assert [c["weight"] for c in published.json()["rubric_snapshot"]] == [30, 30, 25, 15]
    assert api.request("POST", review_url, json=review).status_code == 409
    assert (
        api.request(
            "POST",
            url,
            "alice",
            json={
                "note": "Versió manipulada pel navegador.",
                "version_number": 100,
            },
        ).status_code
        == 422
    )
    second = api.request("POST", url, "alice", json={"note": "Segona proposta amb millores."})
    assert second.json()["version_number"] == 2
    history = api.request("GET", url, "alice").json()
    assert history[0]["review"] == published.json()
    assert history[1]["review"] is None
    assert api.request("GET", url).json() == history
    assert api.request("GET", url, "outsider").status_code == 404
    assert api.request("GET", f"/spaces/{space['id']}/projects?limit=101").status_code == 422
    assert api.request("GET", f"/spaces/{space['id']}/projects?offset=-1").status_code == 422


def test_parallel_submissions_get_unique_contiguous_versions(api):
    _space, _team, project = api.project()
    api.request("GET", "/me", "alice")
    url = f"/projects/{project['id']}/submissions"
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(
            pool.map(
                lambda i: api.request(
                    "POST",
                    url,
                    "alice",
                    json={"note": f"Entrega paral·lela número {i}."},
                ),
                range(6),
            )
        )
    assert [r.status_code for r in responses] == [201] * 6, [r.text for r in responses]
    assert sorted(r.json()["version_number"] for r in responses) == [1, 2, 3, 4, 5, 6]
    assert len(api.request("GET", url, "alice").json()) == 6


def test_persistence_migration_matches_models_and_responses_hide_identity_keys(api):
    space, _team, _project = api.project()
    response = api.request("GET", "/me")
    assert set(response.json()) == {"id", "display_name"}
    with api.app.state.engine.connect() as connection:
        context = MigrationContext.configure(connection)
        assert compare_metadata(context, Base.metadata) == []
    app = create_app(api.settings)
    app.dependency_overrides[get_principal] = principal_override
    with TestClient(app) as other_client:
        assert other_client.get("/readyz").status_code == 200
        rows = other_client.get("/v1/spaces", headers={"Authorization": "Bearer test-teacher"})
        assert rows.json() == [space]


def test_openapi_and_cors_do_not_enable_untrusted_browser_origins(api):
    assert api.client.get("/healthz").json() == {"status": "ok"}
    schema = api.client.get("/openapi.json").json()
    assert "/v1/spaces" in schema["paths"]
    assert "/v1/projects/{project_id}/submissions" in schema["paths"]
    response = api.client.options(
        "/v1/spaces",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in response.headers


def test_simultaneous_invitation_acceptance_enrolls_only_one_user(api):
    space = api.space()
    invite = api.request("POST", f"/spaces/{space['id']}/invitations").json()
    for name in ("alice", "bob"):
        assert api.request("GET", "/me", name).status_code == 200
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(
                lambda name: api.request(
                    "POST",
                    "/invitations/accept",
                    name,
                    json={"token": invite["token"]},
                ),
                ("alice", "bob"),
            )
        )
    assert sorted(r.status_code for r in responses) == [200, 404]
    memberships = [api.request("GET", "/spaces", name).json() for name in ("alice", "bob")]
    assert sorted(len(rows) for rows in memberships) == [0, 1]
