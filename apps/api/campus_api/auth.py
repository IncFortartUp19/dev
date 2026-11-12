import base64
import json
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from campus_api.db import bind_actor, get_db
from campus_api.models import User

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


@dataclass(frozen=True)
class Principal:
    subject: str
    display_name: str
    auth_contexts: tuple[str, ...] = ()


def unauthorized():
    return HTTPException(
        401, "Invalid or missing access token", headers={"WWW-Authenticate": "Bearer"}
    )


def get_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Principal:
    if credentials is None:
        raise unauthorized()
    if len(credentials.credentials) > 16384:
        raise unauthorized()
    settings = request.app.state.settings
    if request.app.state.jwks is None:
        raise HTTPException(503, "OIDC identity provider is not configured")
    try:
        key = request.app.state.jwks.get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            key.key,
            algorithms=["RS256"],
            issuer=settings.oidc_issuer,
            audience=settings.oidc_audience,
            options={"require": ["exp", "iat", "iss", "aud", "sub"], "strict_aud": True},
            leeway=30,
        )
        if not isinstance(claims["sub"], str) or not 1 <= len(claims["sub"]) <= 512:
            raise unauthorized()
        if settings.oidc_required_scope:
            scope = claims.get("scp", claims.get("scope"))
            if not isinstance(scope, str) or settings.oidc_required_scope not in scope.split():
                raise unauthorized()
        if settings.oidc_allowed_clients:
            clients = [claims[key] for key in ("azp", "appid") if key in claims]
            if (
                not clients
                or any(
                    not isinstance(client, str) or client not in settings.oidc_allowed_clients
                    for client in clients
                )
                or len(set(clients)) != 1
            ):
                raise unauthorized()
        name = claims.get("name")
        return Principal(
            subject=f"{settings.oidc_issuer}|{claims['sub']}",
            display_name=name[:100] if isinstance(name, str) and name.strip() else "Campus user",
            auth_contexts=tuple(claims["acrs"])
            if isinstance(claims.get("acrs"), list)
            and all(isinstance(c, str) and len(c) <= 100 for c in claims["acrs"])
            else (),
        )
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise unauthorized() from exc


def get_actor(db: DB, principal: Annotated[Principal, Depends(get_principal)]) -> User:
    user = db.scalar(select(User).where(User.auth_subject == principal.subject))
    if user is None:
        user = User(auth_subject=principal.subject, display_name=principal.display_name)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # Two concurrent authenticated requests can provision the same account.
            db.rollback()
            user = db.scalar(select(User).where(User.auth_subject == principal.subject))
            if user is None:
                raise
    bind_actor(db, user.id)
    return user


Actor = Annotated[User, Depends(get_actor)]


def require_private_context(
    request: Request, principal: Annotated[Principal, Depends(get_principal)]
):
    settings = request.app.state.settings
    context = settings.oidc_private_auth_context
    if not context:
        if settings.environment == "production":
            raise HTTPException(503, "Private authentication policy is not configured")
        return  # Development only; never presented as real MFA verification.
    if context not in principal.auth_contexts:
        claims = json.dumps(
            {"access_token": {"acrs": {"essential": True, "value": context}}}, separators=(",", ":")
        )
        encoded = base64.b64encode(claims.encode()).decode()
        raise HTTPException(
            401,
            {"code": "step_up_required", "message": "Reauthenticate for private project access"},
            headers={"WWW-Authenticate": f'Bearer error="insufficient_claims", claims="{encoded}"'},
        )
