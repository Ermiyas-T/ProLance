import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.review import ReviewType


# reusable 1..5 bound shared by every rating field
RatingScore = Annotated[int, Field(ge=1, le=5)]


# validate request body for reviewing the other party on a completed contract
class ReviewCreate(BaseModel):
    # reject client-supplied id or any other unexpected fields
    model_config = ConfigDict(extra="forbid")

    contract_id: uuid.UUID
    # mandatory headline score; range is enforced here and by a database check constraint
    rating_overall: RatingScore
    # optional sub-scores for the individual dimensions of the engagement
    rating_communication: RatingScore | None = None
    rating_quality: RatingScore | None = None
    rating_timeliness: RatingScore | None = None
    comment: Annotated[str, Field(min_length=1, max_length=5000)]


# the shape we return for a single review in a user's public reputation trail
class ReviewOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy Review row
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contract_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewee_id: uuid.UUID
    review_type: ReviewType
    rating_overall: int
    rating_communication: int | None
    rating_quality: int | None
    rating_timeliness: int | None
    comment: str
    created_at: datetime
