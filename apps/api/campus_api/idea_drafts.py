"""Private-by-default idea drafts. Ownership comes exclusively from verified OIDC."""
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field, StringConstraints
from sqlalchemy import select

from campus_api.auth import Actor, DB, require_private_context
from campus_api.models import IdeaDraft
from campus_api.schemas import Input, Output

router = APIRouter(prefix="/v1/idea-drafts", tags=["private drafts"], dependencies=[Depends(require_private_context)])
Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

class IdeaDraftIn(Input):
    question: Question
    intention: Annotated[str, Field(max_length=3000)] = ""
    next_test: Annotated[str, Field(max_length=3000)] = ""
    name: Annotated[str, Field(max_length=120)] = ""

class IdeaDraftOut(Output):
    id: str
    question: str
    intention: str
    next_test: str
    name: str
    visibility: str
    updated_at: datetime

def owned(db, draft_id, actor):
    item = db.scalar(select(IdeaDraft).where(IdeaDraft.id == str(draft_id), IdeaDraft.owner_id == actor.id))
    if item is None:
        raise HTTPException(404, "Draft not found")
    return item

@router.get("", response_model=list[IdeaDraftOut])
def list_drafts(db: DB, actor: Actor, limit: Annotated[int, Query(ge=1, le=100)] = 50):
    return db.scalars(select(IdeaDraft).where(IdeaDraft.owner_id == actor.id).order_by(IdeaDraft.updated_at.desc(), IdeaDraft.id).limit(limit)).all()

@router.post("", response_model=IdeaDraftOut, status_code=201)
def create_draft(payload: IdeaDraftIn, db: DB, actor: Actor):
    item = IdeaDraft(owner_id=actor.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.get("/{draft_id}", response_model=IdeaDraftOut)
def get_draft(draft_id: UUID, db: DB, actor: Actor):
    return owned(db, draft_id, actor)

@router.post("/{draft_id}", response_model=IdeaDraftOut)
def update_draft(draft_id: UUID, payload: IdeaDraftIn, db: DB, actor: Actor):
    item = owned(db, draft_id, actor)
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    from campus_api.models import now
    item.updated_at = now()
    db.commit()
    db.refresh(item)
    return item
