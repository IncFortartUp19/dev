from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Text100 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class SpaceIn(Input):
    title: Text100
    subject: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    due_at: date | None = None


class TeamIn(Input):
    name: Text100


class ProjectIn(Input):
    title: Text100
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=20, max_length=5000)
    ]
    category: Text100


class SubmissionIn(Input):
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=10000)]


class InvitationIn(Input):
    token: Annotated[str, StringConstraints(min_length=32, max_length=128)]


class ReviewIn(Input):
    scores: Annotated[list[Annotated[float, Field(ge=0, le=10)]], Field(min_length=4, max_length=4)]
    feedback: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=5, max_length=5000)
    ]


RUBRIC = (
    {"id": "problem", "label": "Definició del problema", "weight": 30},
    {"id": "viability", "label": "Proposta i viabilitat", "weight": 30},
    {"id": "evidence", "label": "Desenvolupament i evidències", "weight": 25},
    {"id": "communication", "label": "Comunicació i presentació", "weight": 15},
)


def weighted_score(scores, rubric):
    result = sum(
        Decimal(str(value)) * Decimal(str(c["weight"])) / 100
        for value, c in zip(scores, rubric, strict=True)
    )
    return float(result.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(Output):
    id: str
    display_name: str


class SpaceOut(SpaceIn, Output):
    id: str
    created_by: str
    role: str


class TeamOut(Output):
    id: str
    space_id: str
    name: str


class ProjectOut(ProjectIn, Output):
    id: str
    team_id: str


class ReviewOut(Output):
    id: str
    reviewer_id: str
    scores: list[float]
    rubric_snapshot: list[dict]
    feedback: str
    total: float


class SubmissionOut(Output):
    id: str
    project_id: str
    version_number: int
    note: str
    submitted_by: str
    review: ReviewOut | None = None
