import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite:///.data/campus.db"
    environment: str = "development"
    oidc_issuer: str = ""
    oidc_audience: str = ""
    oidc_jwks_url: str = ""
    oidc_required_scope: str = ""
    oidc_allowed_clients: tuple[str, ...] = ()
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)
    documents_enabled: bool = False
    blob_account_url: str = ""
    blob_upload_client_id: str = ""
    blob_reader_client_id: str = ""

    def __post_init__(self):
        if self.documents_enabled:
            if not re.fullmatch(
                r"https://[a-z0-9]{3,24}\.blob\.core\.windows\.net", self.blob_account_url
            ):
                raise ValueError("Documents require an exact Azure Blob account HTTPS origin.")
            if (
                not self.blob_upload_client_id
                or not self.blob_reader_client_id
                or UUID(self.blob_upload_client_id) == UUID(self.blob_reader_client_id)
            ):
                raise ValueError("Use separate upload and reader managed identities.")
        configured = (self.oidc_issuer, self.oidc_audience, self.oidc_jwks_url)
        if any(configured) and not all(configured):
            raise ValueError("Configure issuer, audience and JWKS URL together.")
        for endpoint in (self.oidc_issuer, self.oidc_jwks_url):
            if endpoint:
                url = urlparse(endpoint)
                if (
                    url.scheme != "https"
                    or not url.hostname
                    or url.username
                    or url.password
                    or url.query
                    or url.fragment
                ):
                    raise ValueError("OIDC endpoints must be explicit HTTPS URLs.")
        if self.oidc_required_scope and any(c.isspace() for c in self.oidc_required_scope):
            raise ValueError("Configure exactly one required API scope.")
        if any(
            not client or any(c.isspace() for c in client) for client in self.oidc_allowed_clients
        ):
            raise ValueError("Allowed OIDC client IDs must be non-empty and contain no whitespace.")
        if (self.oidc_required_scope or self.oidc_allowed_clients) and not all(configured):
            raise ValueError("OIDC token policy requires a configured identity provider.")
        if self.environment == "production":
            if not all(configured) or not self.database_url.startswith("postgresql"):
                raise ValueError("Production requires OIDC and PostgreSQL.")
            if not self.oidc_required_scope or not self.oidc_allowed_clients:
                raise ValueError("Production requires an API scope and allowed OIDC clients.")
            if any(urlparse(origin).scheme != "https" for origin in self.cors_origins):
                raise ValueError("Production CORS origins must use HTTPS.")
        if "*" in self.cors_origins:
            raise ValueError("Configure explicit CORS origins.")

    @classmethod
    def from_env(cls):
        return cls(
            database_url=os.getenv("DATABASE_URL", "sqlite:///.data/campus.db"),
            environment=os.getenv("APP_ENV", "development"),
            documents_enabled=os.getenv("DOCUMENTS_ENABLED", "false") == "true",
            blob_account_url=os.getenv("BLOB_ACCOUNT_URL", ""),
            blob_upload_client_id=os.getenv("BLOB_UPLOAD_CLIENT_ID", ""),
            blob_reader_client_id=os.getenv("BLOB_READER_CLIENT_ID", ""),
            oidc_issuer=os.getenv("OIDC_ISSUER", ""),
            oidc_audience=os.getenv("OIDC_AUDIENCE", ""),
            oidc_jwks_url=os.getenv("OIDC_JWKS_URL", ""),
            oidc_required_scope=os.getenv("OIDC_REQUIRED_SCOPE", ""),
            oidc_allowed_clients=tuple(
                value.strip()
                for value in os.getenv("OIDC_ALLOWED_CLIENTS", "").split(",")
                if value.strip()
            ),
            cors_origins=tuple(
                value.strip()
                for value in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
                if value.strip()
            ),
        )

    def prepare_database_url(self):
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        if url.startswith("sqlite:///") and url != "sqlite:///:memory:":
            Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
        return url
