from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from campus_api.db import get_db
from campus_api.models import User

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


@dataclass(frozen=True)
class Principal:
    subject: str
    display_name: str


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
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            leeway=30,
        )
        if not isinstance(claims["sub"], str) or not 1 <= len(claims["sub"]) <= 512:
            raise unauthorized()
        name = claims.get("name")
        return Principal(
            subject=f"{settings.oidc_issuer}|{claims['sub']}",
            display_name=name[:100] if isinstance(name, str) and name.strip() else "Campus user",
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
    return user


Actor = Annotated[User, Depends(get_actor)]
