from contextlib import asynccontextmanager

import jwt
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from campus_api.auth import require_private_context
from campus_api.blob_store import AzureDocumentStore
from campus_api.config import Settings
from campus_api.database_security import verify_runtime_database
from campus_api.db import make_engine
from campus_api.documents import router as document_router
from campus_api.idea_drafts import router as idea_drafts_router
from campus_api.routes import router
from campus_api.vaults import router as vault_router


def create_app(settings: Settings | None = None):
    settings = settings or Settings.from_env()
    engine = make_engine(settings)

    @asynccontextmanager
    async def lifespan(_app):
        try:
            if settings.environment == "production":
                verify_runtime_database(engine, documents=settings.documents_enabled)
            yield
        finally:
            if app.state.document_store:
                app.state.document_store.close()
            engine.dispose()

    app = FastAPI(title="IncForStartUp Campus API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.document_store = (
        AzureDocumentStore(
            settings.blob_account_url,
            upload_client_id=settings.blob_upload_client_id,
            reader_client_id=settings.blob_reader_client_id,
        )
        if settings.documents_enabled
        else None
    )
    app.state.jwks = (
        jwt.PyJWKClient(settings.oidc_jwks_url, cache_keys=True, timeout=5)
        if settings.oidc_jwks_url
        else None
    )

    @app.middleware("http")
    async def private_responses(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/v1/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-File-Name"],
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
    app.include_router(vault_router)
    app.include_router(idea_drafts_router)
    app.include_router(document_router)

    @app.get("/v1/private-access", dependencies=[Depends(require_private_context)])
    def private_access():
        return {
            "policy_enforced": bool(app.state.settings.oidc_private_auth_context),
            "documents_available": app.state.document_store is not None,
        }

    return app
