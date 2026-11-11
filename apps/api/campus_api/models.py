from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
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
