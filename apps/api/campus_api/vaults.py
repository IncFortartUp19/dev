"""Private project onboarding and authorization, not a document upload service."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import select

from campus_api.auth import DB, Actor
from campus_api.models import ProjectVault, User, VaultEvent, VaultMembership
from campus_api.schemas import Input, Output, Text100

router = APIRouter(prefix="/v1/vaults", tags=["private projects"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0, le=100000)]


class VaultIn(Input):
    name: Text100


class VaultOut(Output):
    id: str
    name: str
    role: str


class GrantIn(Input):
    user_id: UUID
    role: Literal["contributor", "reader"]


class MemberOut(Output):
    user_id: str
    role: str


class EventOut(Output):
    id: str
    actor_id: str
    action: str
    target_id: str
    occurred_at: datetime


def member(db, vault_id, actor, owner=False):
    row = db.get(VaultMembership, (str(vault_id), actor.id))
    if row is None:
        raise HTTPException(404, "Private project not found")
    if owner and row.role != "owner":
        raise HTTPException(403, "Project owner required")
    return row


def event(db, vault_id, actor, action, target_id):
    db.add(
        VaultEvent(
            vault_id=str(vault_id),
            actor_id=actor.id,
            owner_id=actor.id,
            action=action,
            target_id=target_id,
        )
    )


@router.post("", response_model=VaultOut, status_code=201)
def create_vault(payload: VaultIn, db: DB, actor: Actor):
    vault = ProjectVault(name=payload.name, created_by=actor.id)
    db.add(vault)
    db.flush()
    db.add(VaultMembership(vault_id=vault.id, user_id=actor.id, owner_id=actor.id, role="owner"))
    event(db, vault.id, actor, "project.created", vault.id)
    db.commit()
    return VaultOut(id=vault.id, name=vault.name, role="owner")


@router.get("", response_model=list[VaultOut])
def list_vaults(db: DB, actor: Actor, limit: Limit = 50, offset: Offset = 0):
    rows = db.execute(
        select(ProjectVault, VaultMembership.role)
        .join(VaultMembership, VaultMembership.vault_id == ProjectVault.id)
        .where(VaultMembership.user_id == actor.id)
        .order_by(ProjectVault.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return [VaultOut(id=v.id, name=v.name, role=role) for v, role in rows]


@router.get("/{vault_id}", response_model=VaultOut)
def get_vault(vault_id: UUID, db: DB, actor: Actor):
    access = member(db, vault_id, actor)
    vault = db.get(ProjectVault, str(vault_id))
    return VaultOut(id=vault.id, name=vault.name, role=access.role)


@router.get("/{vault_id}/members", response_model=list[MemberOut])
def list_members(vault_id: UUID, db: DB, actor: Actor, limit: Limit = 50, offset: Offset = 0):
    member(db, vault_id, actor, owner=True)
    return db.scalars(
        select(VaultMembership)
        .where(VaultMembership.vault_id == str(vault_id))
        .order_by(VaultMembership.user_id)
        .limit(limit)
        .offset(offset)
    ).all()


@router.post("/{vault_id}/members", response_model=MemberOut, status_code=201)
def grant_member(vault_id: UUID, payload: GrantIn, db: DB, actor: Actor):
    member(db, vault_id, actor, owner=True)
    user_id = str(payload.user_id)
    if db.get(User, user_id) is None:
        raise HTTPException(400, "Recipient account is unavailable")
    # No email/domain matching and no implicit access inherited from another project.
    if db.get(VaultMembership, (str(vault_id), user_id)):
        raise HTTPException(409, "Membership already exists")
    row = VaultMembership(
        vault_id=str(vault_id), user_id=user_id, owner_id=actor.id, role=payload.role
    )
    db.add(row)
    event(db, vault_id, actor, f"member.granted.{payload.role}", user_id)
    db.commit()
    return row


@router.delete("/{vault_id}/members/{user_id}", status_code=204)
def revoke_member(vault_id: UUID, user_id: UUID, db: DB, actor: Actor):
    member(db, vault_id, actor, owner=True)
    row = db.get(VaultMembership, (str(vault_id), str(user_id)))
    if row is None:
        raise HTTPException(404, "Membership not found")
    if row.role == "owner":
        raise HTTPException(409, "Owner cannot be removed")
    db.delete(row)
    event(db, vault_id, actor, "member.revoked", str(user_id))
    db.commit()
    return Response(status_code=204)


@router.get("/{vault_id}/events", response_model=list[EventOut])
def list_events(vault_id: UUID, db: DB, actor: Actor, limit: Limit = 50, offset: Offset = 0):
    member(db, vault_id, actor, owner=True)
    return db.scalars(
        select(VaultEvent)
        .where(VaultEvent.vault_id == str(vault_id))
        .order_by(VaultEvent.occurred_at, VaultEvent.id)
        .limit(limit)
        .offset(offset)
    ).all()
