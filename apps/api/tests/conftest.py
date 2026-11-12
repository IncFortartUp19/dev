import os
import time
from dataclasses import replace
from pathlib import Path
from secrets import token_hex
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from alembic import command
from alembic.config import Config
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

from campus_api.auth import Principal, get_principal
from campus_api.config import Settings
from campus_api.db import make_engine
from campus_api.main import create_app

ROOT = Path(__file__).resolve().parents[1]


def migration_config(settings):
    config = Config(str(ROOT / "alembic.ini"))
    config.attributes["settings"] = settings
    return config


def test_principal(request: Request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer test-"):
        raise HTTPException(401, "Test authentication required")
    name = header.removeprefix("Bearer test-")
    return Principal(subject=f"https://test.local|{name}", display_name=name)


class Harness:
    def __init__(self, app, client, settings):
        self.app, self.client, self.settings = app, client, settings

    def request(self, method, path, actor="teacher", **kwargs):
        return self.client.request(
            method,
            f"/v1{path}",
            headers={"Authorization": f"Bearer test-{actor}"},
            **kwargs,
        )

    def space(self, actor="teacher"):
        response = self.request(
            "POST",
            "/spaces",
            actor,
            json={
                "title": "Laboratori",
                "subject": "Innovació",
                "due_at": "2027-01-20",
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    def enroll(self, space_id, actor="alice"):
        invitation = self.request("POST", f"/spaces/{space_id}/invitations").json()
        response = self.request(
            "POST", "/invitations/accept", actor, json={"token": invitation["token"]}
        )
        assert response.status_code == 200, response.text
        return invitation

    def project(self):
        space = self.space()
        self.enroll(space["id"])
        team = self.request(
            "POST", f"/spaces/{space['id']}/teams", "alice", json={"name": "Reverd"}
        )
        assert team.status_code == 201, team.text
        project = self.request(
            "POST",
            f"/teams/{team.json()['id']}/projects",
            "alice",
            json={
                "title": "Reverd",
                "description": "Transformar els espais del campus en horts compartits.",
                "category": "Sostenibilitat",
            },
        )
        assert project.status_code == 201, project.text
        return space, team.json(), project.json()


@pytest.fixture
def api(tmp_path):
    url = os.getenv("TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'campus.db'}"
    if url.startswith("postgresql") and make_url(url).database != "campus_test":
        raise ValueError("Tests require an ephemeral database named campus_test")
    settings = Settings(database_url=url)
    config = migration_config(settings)
    command.upgrade(config, "head")
    app = create_app(settings)
    app.dependency_overrides[get_principal] = test_principal
    try:
        with TestClient(app) as client:
            yield Harness(app, client, settings)
    finally:
        command.downgrade(config, "base")


@pytest.fixture
def protected_api(api):
    admin = api.app.state.engine
    if admin.dialect.name != "postgresql":
        pytest.skip("PostgreSQL RLS is exercised in the PostgreSQL CI job")
    role = "rls_test_" + uuid4().hex
    password = token_hex(24)
    with admin.begin() as conn:
        conn.execute(
            text(f"CREATE ROLE {role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '{password}'")
        )
        conn.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
        conn.execute(text(f"GRANT SELECT, INSERT ON users TO {role}"))
        # Extra UPDATE/DELETE permissions prove that policies, not missing SQL grants,
        # reject attempts to rewrite ownership or tamper with events.
        conn.execute(
            text(
                "GRANT SELECT, INSERT, UPDATE, DELETE ON project_vaults, "
                f"vault_memberships, vault_events TO {role}"
            )
        )
    url = make_url(api.settings.prepare_database_url()).set(username=role, password=password)
    limited = make_engine(
        replace(api.settings, database_url=url.render_as_string(hide_password=False))
    )

    api.app.state.engine = limited
    try:
        yield api, limited, admin
    finally:
        api.app.state.engine = admin
        limited.dispose()
        with admin.begin() as conn:
            conn.execute(text(f"DROP OWNED BY {role}"))
            conn.execute(text(f"DROP ROLE {role}"))


@pytest.fixture
def signed_api(api):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    api.app.dependency_overrides.pop(get_principal)
    api.app.state.settings = Settings(
        database_url=api.settings.database_url,
        oidc_issuer="https://identity.example/tenant",
        oidc_audience="campus-api",
        oidc_jwks_url="https://identity.example/tenant/jwks",
    )
    api.app.state.jwks = SimpleNamespace(
        get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=private_key.public_key())
    )

    def mint(**changes):
        stamp = int(time.time())
        payload = {
            "iss": "https://identity.example/tenant",
            "aud": "campus-api",
            "sub": "user-123",
            "iat": stamp,
            "exp": stamp + 300,
            "name": "Laia",
        }
        payload.update(changes)
        return jwt.encode(payload, private_key, algorithm="RS256")

    return api, mint
