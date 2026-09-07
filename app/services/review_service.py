from decimal import Decimal

from sqlalchemy import distinct, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.contract import Contract, ContractStatus
from app.models.profile import FreelancerProfile
from app.models.review import Review, ReviewType


# keep missing-resource outcomes distinct from failed ownership checks at the HTTP boundary
class ReviewNotFoundError(Exception):
    pass


# prevent users who are not contract participants from reviewing it
class ReviewParticipationError(Exception):
    pass


# expose attempts to review contracts that are not completed yet
class ContractNotCompletedError(Exception):
    pass


# prevent a participant from reviewing the same contract twice
class DuplicateReviewError(Exception):
    pass


# refresh the freelancer's public reputation aggregates from source review data
def _refresh_freelancer_metrics(db: Session, freelancer_user_id: int) -> None:
    # metrics live on the profile, so silently skip when the freelancer has none
    profile = db.scalar(
        select(FreelancerProfile).where(FreelancerProfile.user_id == freelancer_user_id)
    )
    if profile is None:
        return

    # reputation aggregates only count CLIENT_TO_FREELANCER reviews: work ratings
    work_rating_filters = (
        Review.reviewee_id == freelancer_user_id,
        Review.review_type == ReviewType.CLIENT_TO_FREELANCER,
    )

    # recompute the average work rating instead of incrementing so the math stays correct
    avg_rating = db.scalar(
        select(func.avg(Review.rating_overall)).where(*work_rating_filters)
    )

    # recompute completed projects as distinct client-reviewed contracts to stay idempotent
    completed_count = db.scalar(
        select(func.count(distinct(Review.contract_id))).where(*work_rating_filters)
    )

    # normalize both SQLite floats and PostgreSQL decimals into a fixed 2-digit value
    profile.avg_rating = Decimal(str(avg_rating or 0)).quantize(Decimal("0.01"))
    profile.completed_projects_count = int(completed_count or 0)


# submit one participant's review of the other party on a completed contract
def create_review(db: Session, reviewer_id: int, data) -> Review:
    # retrieve the contract being reviewed
    contract = db.get(Contract, data.contract_id)
    if contract is None:
        raise ReviewNotFoundError

    # unfinished work cannot be reviewed yet
    if contract.status != ContractStatus.COMPLETED:
        raise ContractNotCompletedError

    # derive routing from the reviewer's role in the contract, never from request input
    if reviewer_id == contract.client_id:
        review_type = ReviewType.CLIENT_TO_FREELANCER
        reviewee_id = contract.freelancer_id
    elif reviewer_id == contract.freelancer_id:
        review_type = ReviewType.FREELANCER_TO_CLIENT
        reviewee_id = contract.client_id
    else:
        raise ReviewParticipationError

    # reject duplicate reviews early so the API returns a friendly conflict response
    existing = db.scalar(
        select(Review).where(
            Review.contract_id == contract.id, Review.reviewer_id == reviewer_id
        )
    )
    if existing is not None:
        raise DuplicateReviewError

    # begin the atomic transaction - review and metric updates must succeed together
    try:
        # persist the review with server-derived routing fields
        review = Review(
            contract_id=contract.id,
            reviewer_id=reviewer_id,
            reviewee_id=reviewee_id,
            review_type=review_type,
            rating_overall=data.rating_overall,
            rating_communication=data.rating_communication,
            rating_quality=data.rating_quality,
            rating_timeliness=data.rating_timeliness,
            comment=data.comment,
        )
        db.add(review)

        # flush the pending review so aggregate queries can see it (session autoflush is disabled)
        db.flush()

        # only client reviews of the freelancer move the freelancer's public metrics
        if review_type == ReviewType.CLIENT_TO_FREELANCER:
            _refresh_freelancer_metrics(db, reviewee_id)

        # commit the transaction; the unique constraint is the race-condition backstop
        db.commit()
        db.refresh(review)
        return review

    except IntegrityError:
        # a concurrent duplicate slipped past the pre-check - surface the friendly error
        db.rollback()
        raise DuplicateReviewError
    except Exception:
        # rollback on any other failure to maintain database consistency
        db.rollback()
        raise


# list the reviews a user has received, newest first (public reputation trail)
def get_reviews_for_user(db: Session, user_id: int) -> list[Review]:
    statement = (
        select(Review)
        .where(Review.reviewee_id == user_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
    )
    return list(db.scalars(statement).all())


# compute the average score a user has received across all of their reviews
def calculate_average_rating(db: Session, user_id: int) -> Decimal | None:
    # average over every review received regardless of direction
    avg_rating = db.scalar(
        select(func.avg(Review.rating_overall)).where(Review.reviewee_id == user_id)
    )
    if avg_rating is None:
        return None

    # normalize the aggregate into a fixed 2-digit decimal for stable API output
    return Decimal(str(avg_rating)).quantize(Decimal("0.01"))
