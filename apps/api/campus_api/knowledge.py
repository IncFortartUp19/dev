"""Extractive answers from approved sources with live project authorization."""

from hashlib import sha256
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import StringConstraints
from sqlalchemy import select

from campus_api.auth import DB, Actor, require_private_context
from campus_api.models import KnowledgeSource, ProjectVault
from campus_api.schemas import Input, Text100
from campus_api.vaults import event, member

router = APIRouter(
    prefix="/v1/vaults/{vault_id}/knowledge",
    dependencies=[Depends(require_private_context)],
)


class SourceIn(Input):
    title: Text100
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=12000)]
    source_reference: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
    ]


class StateIn(Input):
    status: Literal["approved", "withdrawn"]


class QuestionIn(Input):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=300)]


def visible_source(db, vault_id, source_id):
    source = db.scalar(
        select(KnowledgeSource).where(
            KnowledgeSource.vault_id == str(vault_id),
            KnowledgeSource.id == str(source_id),
            KnowledgeSource.status == "approved",
        )
    )
    if source is None:
        raise HTTPException(404, "Source not found")
    return source


@router.post("", status_code=201)
def ingest(vault_id: UUID, payload: SourceIn, db: DB, actor: Actor):
    member(db, vault_id, actor, owner=True)
    vault = db.get(ProjectVault, str(vault_id))
    source = KnowledgeSource(
        vault_id=vault.id,
        owner_id=vault.created_by,
        **payload.model_dump(),
        sha256=sha256(payload.body.encode()).hexdigest(),
        status="draft",
    )
    db.add(source)
    db.flush()
    event(db, vault_id, actor, "knowledge.ingested", source.id)
    db.commit()
    return {"id": source.id, "status": source.status, "sha256": source.sha256}


@router.post("/{source_id}/state")
def change_state(vault_id: UUID, source_id: UUID, payload: StateIn, db: DB, actor: Actor):
    member(db, vault_id, actor, owner=True)
    source = db.scalar(
        select(KnowledgeSource).where(
            KnowledgeSource.vault_id == str(vault_id), KnowledgeSource.id == str(source_id)
        )
    )
    if source is None:
        raise HTTPException(404, "Source not found")
    source.status = payload.status
    if payload.status == "approved":
        source.approved_by = actor.id
    event(db, vault_id, actor, "knowledge." + payload.status, source.id)
    db.commit()
    return {"id": source.id, "status": source.status}


@router.post("/answer")
def answer(vault_id: UUID, payload: QuestionIn, db: DB, actor: Actor):
    member(db, vault_id, actor)
    sources = db.scalars(
        select(KnowledgeSource)
        .where(
            KnowledgeSource.vault_id == str(vault_id),
            KnowledgeSource.status == "approved",
            KnowledgeSource.body.icontains(payload.question, autoescape=True),
        )
        .order_by(KnowledgeSource.id)
        .limit(5)
    ).all()
    citations = [
        {
            "source_id": source.id,
            "title": source.title,
            "excerpt": source.body,
            "sha256": source.sha256,
            "href": f"/v1/vaults/{vault_id}/knowledge/{source.id}",
        }
        for source in sources
    ]
    return {
        "mode": "extractive",
        "answer": "Fonts aprovades coincidents."
        if citations
        else "No hi ha evidència autoritzada que coincideixi amb aquesta consulta.",
        "citations": citations,
    }


@router.get("/{source_id}")
def citation(vault_id: UUID, source_id: UUID, db: DB, actor: Actor):
    member(db, vault_id, actor)
    source = visible_source(db, vault_id, source_id)
    return {
        "id": source.id,
        "title": source.title,
        "body": source.body,
        "sha256": source.sha256,
    }
