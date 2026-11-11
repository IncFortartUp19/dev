import hashlib
import secrets
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, update

from campus_api.access import (
    audit,
    membership,
    readable_project,
    require_teacher,
    require_team_member,
)
from campus_api.auth import DB, Actor
from campus_api.models import (
    Invitation,
    Project,
    Review,
    Space,
    SpaceMembership,
    Submission,
    Team,
    TeamMembership,
    now,
)
from campus_api.schemas import (
    RUBRIC,
    InvitationIn,
    ProjectIn,
    ProjectOut,
    ReviewIn,
    ReviewOut,
    SpaceIn,
    SpaceOut,
    SubmissionIn,
    SubmissionOut,
    TeamIn,
    TeamOut,
    UserOut,
    weighted_score,
)

router = APIRouter(prefix="/v1")
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0, le=10000)]


def review_out(review):
    if review is None:
        return None
    return ReviewOut(
        id=review.id,
        reviewer_id=review.reviewer_id,
        scores=review.scores,
        rubric_snapshot=review.rubric_snapshot,
        feedback=review.feedback,
        total=weighted_score(review.scores, review.rubric_snapshot),
    )


def issue_invitation(db, actor, space_id, team_id=None):
    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        space_id=space_id,
        team_id=team_id,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        created_by=actor.id,
        expires_at=now() + timedelta(hours=24),
    )
    db.add(invitation)
    db.flush()
    audit(db, actor, space_id, "invitation.created", invitation.id)
    db.commit()
    # This is the only response containing the token. It is never saved in plaintext.
    return {"id": invitation.id, "token": token, "expires_at": invitation.expires_at}


@router.get("/me", response_model=UserOut)
def me(actor: Actor):
    return actor


@router.post("/spaces", status_code=201, response_model=SpaceOut)
def create_space(payload: SpaceIn, db: DB, actor: Actor):
    space = Space(**payload.model_dump(), created_by=actor.id)
    db.add(space)
    db.flush()
    db.add(SpaceMembership(space_id=space.id, user_id=actor.id, role="teacher"))
    audit(db, actor, space.id, "space.created", space.id)
    db.commit()
    return SpaceOut(**payload.model_dump(), id=space.id, created_by=actor.id, role="teacher")


@router.get("/spaces", response_model=list[SpaceOut])
def list_spaces(db: DB, actor: Actor, limit: Limit = 50, offset: Offset = 0):
    pairs = db.execute(
        select(Space, SpaceMembership.role)
        .join(SpaceMembership)
        .where(SpaceMembership.user_id == actor.id)
        .order_by(Space.created_at, Space.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return [
        SpaceOut(
            id=s.id,
            title=s.title,
            subject=s.subject,
            due_at=s.due_at,
            created_by=s.created_by,
            role=role,
        )
        for s, role in pairs
    ]


@router.post("/spaces/{space_id}/invitations", status_code=201)
def invite_to_space(space_id: str, db: DB, actor: Actor):
    require_teacher(db, space_id, actor)
    return issue_invitation(db, actor, space_id)


@router.post("/teams/{team_id}/invitations", status_code=201)
def invite_to_team(team_id: str, db: DB, actor: Actor):
    team = require_team_member(db, team_id, actor)
    return issue_invitation(db, actor, team.space_id, team.id)


@router.post("/invitations/accept")
def accept_invitation(payload: InvitationIn, db: DB, actor: Actor):
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    invitation = db.scalar(select(Invitation).where(Invitation.token_hash == token_hash))
    if invitation is None:
        raise HTTPException(404, "Invitation invalid, expired or already used")
    existing = db.get(SpaceMembership, (invitation.space_id, actor.id))
    if invitation.team_id and (existing is None or existing.role != "student"):
        raise HTTPException(403, "Join the space as a student before accepting a team invitation")
    stamp = now()
    result = db.execute(
        update(Invitation)
        .where(
            Invitation.id == invitation.id,
            Invitation.consumed_at.is_(None),
            Invitation.expires_at > stamp,
        )
        .values(consumed_at=stamp)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        raise HTTPException(404, "Invitation invalid, expired or already used")
    if existing is None:
        db.add(SpaceMembership(space_id=invitation.space_id, user_id=actor.id, role="student"))
    if invitation.team_id and db.get(TeamMembership, (invitation.team_id, actor.id)) is None:
        db.add(TeamMembership(team_id=invitation.team_id, user_id=actor.id))
    audit(db, actor, invitation.space_id, "invitation.accepted", invitation.id)
    db.commit()
    return {"space_id": invitation.space_id, "team_id": invitation.team_id}


@router.delete("/invitations/{invitation_id}", status_code=204)
def revoke_invitation(invitation_id: str, db: DB, actor: Actor):
    invitation = db.get(Invitation, invitation_id)
    if invitation is None:
        raise HTTPException(404, "Invitation not found")
    member = db.get(SpaceMembership, (invitation.space_id, actor.id))
    if member is None or (member.role != "teacher" and invitation.created_by != actor.id):
        raise HTTPException(404, "Invitation not found")
    invitation.consumed_at = now()
    audit(db, actor, invitation.space_id, "invitation.revoked", invitation.id)
    db.commit()


@router.post("/spaces/{space_id}/teams", status_code=201, response_model=TeamOut)
def create_team(space_id: str, payload: TeamIn, db: DB, actor: Actor):
    if membership(db, space_id, actor).role != "student":
        raise HTTPException(403, "Student membership required")
    team = Team(space_id=space_id, name=payload.name)
    db.add(team)
    db.flush()
    db.add(TeamMembership(team_id=team.id, user_id=actor.id))
    audit(db, actor, space_id, "team.created", team.id)
    db.commit()
    return team


@router.get("/spaces/{space_id}/teams", response_model=list[TeamOut])
def list_teams(space_id: str, db: DB, actor: Actor, limit: Limit = 50, offset: Offset = 0):
    member = membership(db, space_id, actor)
    query = select(Team).where(Team.space_id == space_id)
    if member.role != "teacher":
        query = query.join(TeamMembership).where(TeamMembership.user_id == actor.id)
    return db.scalars(query.order_by(Team.created_at, Team.id).limit(limit).offset(offset)).all()


@router.post("/teams/{team_id}/projects", status_code=201, response_model=ProjectOut)
def create_project(team_id: str, payload: ProjectIn, db: DB, actor: Actor):
    team = require_team_member(db, team_id, actor)
    project = Project(**payload.model_dump(), team_id=team.id)
    db.add(project)
    db.flush()
    audit(db, actor, team.space_id, "project.created", project.id)
    db.commit()
    return project


@router.get("/spaces/{space_id}/projects", response_model=list[ProjectOut])
def list_projects(space_id: str, db: DB, actor: Actor, limit: Limit = 50, offset: Offset = 0):
    member = membership(db, space_id, actor)
    query = select(Project).join(Team).where(Team.space_id == space_id)
    if member.role != "teacher":
        query = query.join(TeamMembership).where(TeamMembership.user_id == actor.id)
    return db.scalars(
        query.order_by(Project.created_at, Project.id).limit(limit).offset(offset)
    ).all()


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: DB, actor: Actor):
    project, _team = readable_project(db, project_id, actor)
    return project


@router.post("/projects/{project_id}/submissions", status_code=201, response_model=SubmissionOut)
def submit(project_id: str, payload: SubmissionIn, db: DB, actor: Actor):
    project, team = readable_project(db, project_id, actor)
    require_team_member(db, team.id, actor)
    # Atomic counter serializes parallel submissions without MAX(version) races.
    next_version = db.scalar(
        update(Project)
        .where(Project.id == project.id)
        .values(next_version=Project.next_version + 1)
        .returning(Project.next_version)
    )
    submission = Submission(
        project_id=project.id,
        note=payload.note,
        submitted_by=actor.id,
        version_number=next_version - 1,
    )
    db.add(submission)
    db.flush()
    audit(db, actor, team.space_id, "submission.created", submission.id)
    db.commit()
    return submission


@router.get("/projects/{project_id}/submissions", response_model=list[SubmissionOut])
def list_submissions(project_id: str, db: DB, actor: Actor, limit: Limit = 50, offset: Offset = 0):
    readable_project(db, project_id, actor)
    rows = db.execute(
        select(Submission, Review)
        .outerjoin(Review)
        .where(Submission.project_id == project_id)
        .order_by(Submission.version_number)
        .limit(limit)
        .offset(offset)
    ).all()
    return [
        SubmissionOut(
            id=s.id,
            project_id=s.project_id,
            note=s.note,
            version_number=s.version_number,
            submitted_by=s.submitted_by,
            review=review_out(review),
        )
        for s, review in rows
    ]


@router.post("/submissions/{submission_id}/reviews", status_code=201, response_model=ReviewOut)
def publish_review(submission_id: str, payload: ReviewIn, db: DB, actor: Actor):
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(404, "Submission not found")
    _project, team = readable_project(db, submission.project_id, actor)
    require_teacher(db, team.space_id, actor)
    if db.scalar(select(Review.id).where(Review.submission_id == submission.id)):
        raise HTTPException(409, "This submission already has a published review")
    review = Review(
        submission_id=submission.id,
        reviewer_id=actor.id,
        scores=payload.scores,
        feedback=payload.feedback,
        rubric_snapshot=[dict(c) for c in RUBRIC],
    )
    db.add(review)
    db.flush()
    audit(db, actor, team.space_id, "review.published", review.id)
    db.commit()
    return review_out(review)
