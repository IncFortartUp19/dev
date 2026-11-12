import time
from dataclasses import replace
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from campus_api.auth import get_principal
from campus_api.config import Settings
from campus_api.main import create_app


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


def test_missing_and_unconfigured_identity_provider_fail_closed(api):
    api.app.dependency_overrides.clear()
    assert api.client.get("/v1/me").status_code == 401
    assert api.client.get("/v1/me", headers={"Authorization": "Bearer anything"}).status_code == 503


def test_signed_identity_provisions_a_user_without_trusting_role_claims(signed_api):
    api, mint = signed_api
    token = mint(roles=["teacher", "administrator"])
    headers = {"Authorization": f"Bearer {token}"}
    response = api.client.get("/v1/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["display_name"] == "Laia"
    assert api.client.get("/v1/spaces", headers=headers).json() == []
    assert api.client.get("/v1/me", headers=headers).json() == response.json()


@pytest.mark.parametrize(
    "changes",
    [
        {"iss": "https://attacker.example"},
        {"aud": "other-api"},
        {"exp": 1},
        {"iat": 9999999999},
        {"sub": ""},
    ],
)
def test_invalid_token_claims_cannot_access_campus(signed_api, changes):
    api, mint = signed_api
    response = api.client.get("/v1/me", headers={"Authorization": f"Bearer {mint(**changes)}"})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_unsigned_and_tampered_tokens_are_rejected(signed_api):
    api, mint = signed_api
    token = mint()
    parts = token.split(".")
    parts[2] = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
    assert (
        api.client.get(
            "/v1/me",
            headers={
                "Authorization": f"Bearer {'.'.join(parts)}",
            },
        ).status_code
        == 401
    )
    unsigned = jwt.encode(
        {"sub": "teacher", "exp": int(time.time()) + 300}, key=None, algorithm="none"
    )
    assert (
        api.client.get("/v1/me", headers={"Authorization": f"Bearer {unsigned}"}).status_code == 401
    )
    assert (
        api.client.get("/v1/me", headers={"Authorization": "Bearer " + "x" * 16385}).status_code
        == 401
    )


def test_readiness_requires_migrations_and_production_requires_identity(tmp_path):
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'unmigrated.db'}"))
    with TestClient(app) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/readyz").status_code == 503
    with pytest.raises(ValueError):
        Settings(environment="production")
    with pytest.raises(ValueError):
        Settings(oidc_issuer="https://identity.example")
    with pytest.raises(ValueError):
        Settings(cors_origins=("*",))


@pytest.mark.parametrize(
    "changes",
    [
        {"scope": "other.read"},
        {"scope": "vault.access.extra"},
        {"scope": ["vault.access"]},
        {"azp": "untrusted-client"},
        {"azp": None},
        {"azp": "web-client", "appid": "untrusted-client"},
        {"aud": ["campus-api", "other-api"]},
    ],
)
def test_federation_policy_rejects_wrong_scopes_clients_and_multiple_audiences(signed_api, changes):
    api, mint = signed_api
    api.app.state.settings = replace(
        api.app.state.settings,
        oidc_required_scope="vault.access",
        oidc_allowed_clients=("web-client",),
    )
    claims = {"scope": "openid vault.access", "azp": "web-client", **changes}
    assert (
        api.client.get("/v1/me", headers={"Authorization": f"Bearer {mint(**claims)}"}).status_code
        == 401
    )


def test_federation_scope_and_client_policy_accepts_provider_claims(signed_api):
    api, mint = signed_api
    api.app.state.settings = replace(
        api.app.state.settings,
        oidc_required_scope="vault.access",
        oidc_allowed_clients=("web-client",),
    )
    for claims in (
        {"scp": "vault.access", "azp": "web-client"},
        {"scope": "openid vault.access", "appid": "web-client"},
    ):
        assert (
            api.client.get(
                "/v1/me", headers={"Authorization": f"Bearer {mint(**claims)}"}
            ).status_code
            == 200
        )
    # An ID token or app-only token without delegated API scope is not sufficient.
    assert (
        api.client.get(
            "/v1/me", headers={"Authorization": f"Bearer {mint(azp='web-client')}"}
        ).status_code
        == 401
    )


def test_matching_email_does_not_link_federated_accounts(signed_api):
    api, mint = signed_api
    ids = [
        api.client.get(
            "/v1/me", headers={"Authorization": f"Bearer {mint(sub=sub, email='same@example.org')}"}
        ).json()["id"]
        for sub in ("first", "second")
    ]
    assert ids[0] != ids[1]


def test_production_requires_explicit_delegated_token_policy():
    base = dict(
        environment="production",
        database_url="postgresql://localhost/campus",
        oidc_issuer="https://identity.example/tenant",
        oidc_audience="campus-api",
        oidc_jwks_url="https://identity.example/jwks",
        cors_origins=("https://campus.example",),
    )
    with pytest.raises(ValueError):
        Settings(**base)
    assert Settings(
        **base, oidc_required_scope="vault.access", oidc_allowed_clients=("web-client",)
    )
    for url in (
        "http://identity.example",
        "https://user:pass@identity.example",
        "https://identity.example/#fragment",
    ):
        with pytest.raises(ValueError):
            Settings(
                oidc_issuer=url,
                oidc_audience="campus-api",
                oidc_jwks_url="https://identity.example/jwks",
            )
