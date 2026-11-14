from dataclasses import replace
from uuid import uuid4

import pytest


@pytest.mark.parametrize(
    "claims",
    [{}, {"amr": ["mfa"]}, {"acrs": ["c2"]}, {"acrs": "c1"}, {"acrs": ["c1", {"invalid": True}]}],
)
def test_private_access_requires_the_configured_signed_context(signed_api, claims):
    api, mint = signed_api
    api.app.state.settings = replace(api.app.state.settings, oidc_private_auth_context="c1")
    headers = {"Authorization": f"Bearer {mint(**claims)}", "X-MFA": "true"}
    # Campus remains separate; a valid token alone cannot access private projects.
    assert api.client.get("/v1/me", headers=headers).status_code == 200
    for path in (
        "/v1/private-access",
        "/v1/vaults",
        "/v1/idea-drafts",
        f"/v1/vaults/{uuid4()}/documents",
        f"/v1/vaults/{uuid4()}/documents/{uuid4()}/content",
    ):
        response = api.client.get(path, headers=headers)
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "step_up_required"
        assert "insufficient_claims" in response.headers["WWW-Authenticate"]
    response = api.client.post("/v1/vaults", headers=headers, json={"name": "Must not be created"})
    assert response.status_code == 401


def test_private_auth_context_authorizes_only_normal_project_memberships(signed_api):
    api, mint = signed_api
    api.app.state.settings = replace(api.app.state.settings, oidc_private_auth_context="c1")
    headers = {"Authorization": f"Bearer {mint(acrs=['c1'])}"}
    assert api.client.get("/v1/private-access", headers=headers).json()["policy_enforced"]
    assert api.client.get("/v1/vaults", headers=headers).json() == []
    response = api.client.post("/v1/vaults", headers=headers, json={"name": "Private"})
    assert response.status_code == 201
    other = {"Authorization": f"Bearer {mint(acrs=['c1'], sub='another-account')}"}
    assert api.client.get(f"/v1/vaults/{response.json()['id']}", headers=other).status_code == 404


def test_production_private_routes_fail_closed_without_context_configuration(signed_api):
    api, mint = signed_api
    # Settings is made production-like only after test DB construction.
    from types import SimpleNamespace

    api.app.state.settings = SimpleNamespace(
        **{**vars(api.app.state.settings), "environment": "production"}
    )
    assert (
        api.client.get(
            "/v1/private-access", headers={"Authorization": f"Bearer {mint()}"}
        ).status_code
        == 503
    )
