import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


# define which direction a review flows based on the reviewer's contract role
class ReviewType(str, enum.Enum):
    CLIENT_TO_FREELANCER = "CLIENT_TO_FREELANCER"
    FREELANCER_TO_CLIENT = "FREELANCER_TO_CLIENT"


# persist one participant's evaluation of the other party on a completed contract
class Review(Base):
    __tablename__: str = "reviews"
    __table_args__ = (
        # enforce one review per reviewer per contract so races can't create duplicates
        UniqueConstraint("contract_id", "reviewer_id", name="uq_reviews_contract_reviewer"),
        # defend numeric scores at the database layer even when data bypasses the HTTP API
        CheckConstraint("rating_overall BETWEEN 1 AND 5", name="check_reviews_rating_overall_range"),
        CheckConstraint(
            "rating_communication IS NULL OR rating_communication BETWEEN 1 AND 5",
            name="check_reviews_rating_communication_range",
        ),
        CheckConstraint(
            "rating_quality IS NULL OR rating_quality BETWEEN 1 AND 5",
            name="check_reviews_rating_quality_range",
        ),
        CheckConstraint(
            "rating_timeliness IS NULL OR rating_timeliness BETWEEN 1 AND 5",
            name="check_reviews_rating_timeliness_range",
        ),
        # optimize the public profile query: reviews for a reviewee ordered by recency
        Index("idx_reviews_reviewee_id", "reviewee_id"),
    )

    # use database-generated UUID with fallback for tests
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    # link the review to the completed contract it evaluates
    contract_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("contracts.id"), nullable=False
    )
    # link the review to the participant writing it
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # link the review to the participant being evaluated
    reviewee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # routing is derived from the reviewer's contract role, never accepted from request input
    review_type: Mapped[ReviewType] = mapped_column(Enum(ReviewType), nullable=False)
    # mandatory headline score validated to the 1..5 range by a database check constraint
    rating_overall: Mapped[int] = mapped_column(nullable=False)
    # optional sub-scores letting reviewers rate individual dimensions of the work
    rating_communication: Mapped[int | None] = mapped_column(nullable=True)
    rating_quality: Mapped[int | None] = mapped_column(nullable=True)
    rating_timeliness: Mapped[int | None] = mapped_column(nullable=True)
    # store the reviewer's free-form feedback about the engagement
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
