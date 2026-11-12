from datetime import datetime
from hashlib import sha256
from pathlib import PurePosixPath
from urllib.parse import quote, unquote
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from campus_api.auth import DB, Actor
from campus_api.blob_store import MAX_BYTES, BlobRef, StorageFailure, checked_bytes
from campus_api.models import ProjectVault, VaultDocument, VaultEvent
from campus_api.schemas import Output
from campus_api.vaults import Limit, Offset, member

router = APIRouter(prefix="/v1/vaults/{vault_id}/documents", tags=["private documents"])


class DocumentOut(Output):
    id: str
    vault_id: str
    filename: str
    media_type: str
    size: int
    status: str
    uploaded_by: str
    created_at: datetime


def store_for(request):
    store = request.app.state.document_store
    if store is None:
        raise HTTPException(503, "Document storage is not configured")
    return store


def validate_file(filename, media_type, data):
    if (
        not filename
        or len(filename) > 180
        or any(ord(c) < 32 or ord(c) == 127 or c in "/\\" for c in filename)
    ):
        raise HTTPException(422, "Invalid document filename")
    if not data:
        raise HTTPException(422, "Empty document")
    suffix = PurePosixPath(filename).suffix.lower()
    if media_type == "application/pdf" and suffix == ".pdf" and data.startswith(b"%PDF-"):
        return
    if media_type == "text/plain" and suffix == ".txt":
        try:
            text = data.decode("utf-8")
            if any(ord(c) < 32 and c not in "\t\r\n" for c in text):
                raise ValueError("Control characters")
            return
        except (UnicodeDecodeError, ValueError):
            pass
    raise HTTPException(415, "Only PDF and UTF-8 plain text are supported")


def audit_document(db, actor, doc, action):
    db.add(
        VaultEvent(
            vault_id=doc.vault_id,
            owner_id=doc.owner_id,
            actor_id=actor.id,
            action=action,
            target_id=doc.id,
        )
    )


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(vault_id: UUID, request: Request, db: DB, actor: Actor):
    access = member(db, vault_id, actor)
    if access.role not in ("owner", "contributor"):
        raise HTTPException(403, "Document upload requires contributor membership")
    store = store_for(request)
    try:
        filename = unquote(request.headers.get("x-file-name", ""), errors="strict")
    except UnicodeDecodeError as exc:
        raise HTTPException(422, "Invalid UTF-8 document filename") from exc
    media_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Document exceeds 10 MiB")
        data.extend(chunk)
    validate_file(filename, media_type, data)
    vault = db.get(ProjectVault, str(vault_id))
    if vault is None:
        raise HTTPException(404, "Private project not found")
    doc = VaultDocument(
        vault_id=str(vault_id),
        owner_id=vault.created_by,
        uploaded_by=actor.id,
        filename=filename,
        media_type=media_type,
        size=len(data),
        sha256=sha256(data).hexdigest(),
        status="uploading",
    )
    db.add(doc)
    db.commit()
    try:
        ref = await run_in_threadpool(
            store.upload, f"{doc.vault_id}/{doc.id}", bytes(data), media_type
        )
    except StorageFailure as exc:
        doc.status = "failed"
        db.commit()
        raise HTTPException(502, "Document upload failed") from exc
    doc.source_etag, doc.source_version, doc.status = ref.etag, ref.version, "quarantined"
    audit_document(db, actor, doc, "document.uploaded")
    db.commit()
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(vault_id: UUID, db: DB, actor: Actor, limit: Limit = 50, offset: Offset = 0):
    member(db, vault_id, actor)
    return db.scalars(
        select(VaultDocument)
        .where(VaultDocument.vault_id == str(vault_id))
        .order_by(VaultDocument.created_at, VaultDocument.id)
        .limit(limit)
        .offset(offset)
    ).all()


@router.get("/{document_id}/content")
def download_document(vault_id: UUID, document_id: UUID, request: Request, db: DB, actor: Actor):
    member(db, vault_id, actor)
    doc = db.scalar(
        select(VaultDocument).where(
            VaultDocument.id == str(document_id), VaultDocument.vault_id == str(vault_id)
        )
    )
    if doc is None:
        raise HTTPException(404, "Document not found")
    if doc.status != "released":
        raise HTTPException(423, "Document is not cleared for download")
    store = store_for(request)
    try:
        data = checked_bytes(
            store.read(
                f"{doc.vault_id}/{doc.id}",
                BlobRef(doc.released_etag, doc.released_version),
                doc.size,
            ),
            doc.size,
            doc.sha256,
        )
    except StorageFailure as exc:
        raise HTTPException(502, "Document unavailable") from exc
    audit_document(db, actor, doc, "document.downloaded")
    db.commit()
    return Response(
        data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="document{PurePosixPath(doc.filename).suffix.lower()}"; '
                f"filename*=UTF-8''{quote(doc.filename, safe='')}"
            ),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
