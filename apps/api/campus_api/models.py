from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from campus_api.db import Base


def now():
    return datetime.now(UTC)


def identifier():
    return str(uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    auth_subject: Mapped[str] = mapped_column(String(1024), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Space(Base):
    __tablename__ = "spaces"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    title: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(150))
    due_at: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SpaceMembership(Base):
    __tablename__ = "space_memberships"
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(10))
    __table_args__ = (
        CheckConstraint("role IN ('teacher', 'student')", name="ck_space_role"),
        Index("ix_space_membership_user", "user_id", "space_id"),
    )


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TeamMembership(Base):
    __tablename__ = "team_memberships"
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    __table_args__ = (Index("ix_team_membership_user", "user_id", "team_id"),)


class Invitation(Base):
    __tablename__ = "invitations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    team_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(5000))
    category: Mapped[str] = mapped_column(String(100))
    next_version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (CheckConstraint("next_version > 0", name="ck_project_version"),)


class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    version_number: Mapped[int]
    note: Mapped[str] = mapped_column(String(10000))
    submitted_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("project_id", "version_number", name="uq_submission_version"),
        CheckConstraint("version_number > 0", name="ck_submission_version"),
    )


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    submission_id: Mapped[str] = mapped_column(ForeignKey("submissions.id"), unique=True)
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    scores: Mapped[list[float]] = mapped_column(JSON)
    rubric_snapshot: Mapped[list[dict]] = mapped_column(JSON)
    feedback: Mapped[str] = mapped_column(String(5000))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(36))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ProjectVault(Base):
    """One private project boundary; unrelated to Campus teacher/team permissions."""

    __tablename__ = "project_vaults"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    name: Mapped[str] = mapped_column(String(100))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (Index("uq_vault_owner", "id", "created_by", unique=True),)


class VaultMembership(Base):
    __tablename__ = "vault_memberships"
    vault_id: Mapped[str] = mapped_column(ForeignKey("project_vaults.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(12))
    owner_id: Mapped[str] = mapped_column(String(36))
    __table_args__ = (
        CheckConstraint("role IN ('owner', 'contributor', 'reader')", name="ck_vault_role"),
        Index("ix_vault_membership_user", "user_id", "vault_id"),
        ForeignKeyConstraint(
            ["vault_id", "owner_id"],
            ["project_vaults.id", "project_vaults.created_by"],
            name="fk_membership_vault_owner",
        ),
        CheckConstraint(
            "role <> 'owner' OR user_id = owner_id", name="ck_membership_owner_identity"
        ),
    )


class VaultEvent(Base):
    __tablename__ = "vault_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    vault_id: Mapped[str] = mapped_column(ForeignKey("project_vaults.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(40))
    target_id: Mapped[str] = mapped_column(String(36))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    owner_id: Mapped[str] = mapped_column(String(36))
    __table_args__ = (
        ForeignKeyConstraint(
            ["vault_id", "owner_id"],
            ["project_vaults.id", "project_vaults.created_by"],
            name="fk_event_vault_owner",
        ),
    )


class VaultDocument(Base):
    __tablename__ = "vault_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    vault_id: Mapped[str] = mapped_column(ForeignKey("project_vaults.id"), index=True)
    owner_id: Mapped[str] = mapped_column(String(36))
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(180))
    media_type: Mapped[str] = mapped_column(String(40))
    size: Mapped[int]
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="uploading")
    source_etag: Mapped[str | None] = mapped_column(String(100))
    source_version: Mapped[str | None] = mapped_column(String(100))
    released_etag: Mapped[str | None] = mapped_column(String(100))
    released_version: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["vault_id", "owner_id"],
            ["project_vaults.id", "project_vaults.created_by"],
            name="fk_document_vault_owner",
        ),
        CheckConstraint(
            "status IN ('uploading', 'quarantined', 'released', 'blocked', 'failed')",
            name="ck_document_status",
        ),
        CheckConstraint("size > 0 AND size <= 10485760", name="ck_document_size"),
        CheckConstraint(
            "status NOT IN ('quarantined','released') OR "
            "(source_etag IS NOT NULL AND source_version IS NOT NULL "
            "AND source_etag <> '' AND source_version <> '')",
            name="ck_document_source_version",
        ),
        CheckConstraint(
            "status <> 'released' OR (released_etag IS NOT NULL AND released_version IS NOT NULL)",
            name="ck_document_released_version",
        ),
        Index("uq_document_vault", "id", "vault_id", unique=True),
    )


class ScanReceipt(Base):
    __tablename__ = "document_scan_receipts"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    document_id: Mapped[str] = mapped_column(String(36))
    vault_id: Mapped[str] = mapped_column(String(36), index=True)
    event_sha256: Mapped[str] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(16))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(
            ["document_id", "vault_id"],
            ["vault_documents.id", "vault_documents.vault_id"],
            name="fk_receipt_document_vault",
        ),
    )


class IdeaDraft(Base):
    __tablename__ = "idea_drafts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    question: Mapped[str] = mapped_column(String(2000))
    intention: Mapped[str] = mapped_column(String(3000), default="")
    next_test: Mapped[str] = mapped_column(String(3000), default="")
    name: Mapped[str] = mapped_column(String(120), default="")
    visibility: Mapped[str] = mapped_column(String(12), default="private")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        CheckConstraint("visibility = 'private'", name="ck_idea_drafts_private"),
        CheckConstraint("length(trim(question)) > 0", name="ck_idea_drafts_question"),
        Index("ix_idea_drafts_owner_updated", "owner_id", "updated_at"),
    )
