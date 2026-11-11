import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite:///.data/campus.db"
    environment: str = "development"
    oidc_issuer: str = ""
    oidc_audience: str = ""
    oidc_jwks_url: str = ""
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)

    def __post_init__(self):
        configured = (self.oidc_issuer, self.oidc_audience, self.oidc_jwks_url)
        if any(configured) and not all(configured):
            raise ValueError("Configure issuer, audience and JWKS URL together.")
        if self.oidc_jwks_url and urlparse(self.oidc_jwks_url).scheme != "https":
            raise ValueError("OIDC JWKS must use HTTPS.")
        if self.environment == "production":
            if not all(configured) or not self.database_url.startswith("postgresql"):
                raise ValueError("Production requires OIDC and PostgreSQL.")
            if any(urlparse(origin).scheme != "https" for origin in self.cors_origins):
                raise ValueError("Production CORS origins must use HTTPS.")
        if "*" in self.cors_origins:
            raise ValueError("Configure explicit CORS origins.")

    @classmethod
    def from_env(cls):
        return cls(
            database_url=os.getenv("DATABASE_URL", "sqlite:///.data/campus.db"),
            environment=os.getenv("APP_ENV", "development"),
            oidc_issuer=os.getenv("OIDC_ISSUER", ""),
            oidc_audience=os.getenv("OIDC_AUDIENCE", ""),
            oidc_jwks_url=os.getenv("OIDC_JWKS_URL", ""),
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
