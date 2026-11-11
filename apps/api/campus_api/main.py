from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from campus_api.config import Settings
from campus_api.db import make_engine
from campus_api.routes import router


def create_app(settings: Settings | None = None):
    settings = settings or Settings.from_env()
    engine = make_engine(settings)

    @asynccontextmanager
    async def lifespan(_app):
        yield
        engine.dispose()

    app = FastAPI(title="IncForStartUp Campus API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.jwks = (
        jwt.PyJWKClient(settings.oidc_jwks_url, cache_keys=True, timeout=5)
        if settings.oidc_jwks_url
        else None
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(IntegrityError)
    async def conflict(_request: Request, _error):
        return JSONResponse(status_code=409, content={"detail": "Resource conflict"})

    @app.get("/healthz")
    def health():
        return {"status": "ok"}

    @app.get("/readyz")
    def ready():
        try:
            with engine.connect() as connection:
                # The migration version table must exist, not just the DB connection.
                version = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar()
                if not version:
                    raise RuntimeError("Database is not migrated")
            return {"status": "ready"}
        except (SQLAlchemyError, RuntimeError):
            return JSONResponse(status_code=503, content={"status": "not_ready"})

    app.include_router(router)
    return app
