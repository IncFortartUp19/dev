import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url

from campus_api.auth import Principal, get_principal
from campus_api.config import Settings
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
