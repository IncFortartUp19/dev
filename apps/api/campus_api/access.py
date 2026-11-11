from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from campus_api.models import AuditEvent, Project, SpaceMembership, Team, TeamMembership, User


def membership(db: Session, space_id: str, actor: User):
    row = db.get(SpaceMembership, (space_id, actor.id))
    if row is None:
        raise HTTPException(404, "Space not found")
    return row


def require_teacher(db: Session, space_id: str, actor: User):
    row = membership(db, space_id, actor)
    if row.role != "teacher":
        raise HTTPException(403, "Teacher membership required")
    return row


def require_team_member(db: Session, team_id: str, actor: User):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(404, "Team not found")
    row = membership(db, team.space_id, actor)
    if row.role != "student" or db.get(TeamMembership, (team.id, actor.id)) is None:
        raise HTTPException(404, "Team not found")
    return team


def readable_project(db: Session, project_id: str, actor: User):
    pair = db.execute(select(Project, Team).join(Team).where(Project.id == project_id)).first()
    if pair is None:
        raise HTTPException(404, "Project not found")
    project, team = pair
    member = db.get(SpaceMembership, (team.space_id, actor.id))
    if member is None or (
        member.role != "teacher" and db.get(TeamMembership, (team.id, actor.id)) is None
    ):
        raise HTTPException(404, "Project not found")
    return project, team


def audit(db: Session, actor: User, space_id: str, action: str, entity_id: str):
    db.add(AuditEvent(actor_id=actor.id, space_id=space_id, action=action, entity_id=entity_id))
