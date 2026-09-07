from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewOut
from app.services.review_service import (
    ContractNotCompletedError,
    DuplicateReviewError,
    ReviewNotFoundError,
    ReviewParticipationError,
    calculate_average_rating,
    create_review,
    get_reviews_for_user,
)


# expose review actions under one resource router
router = APIRouter(tags=["reviews"])


# convert review-domain failures into stable, safe HTTP responses at the API boundary
def _raise_review_http_error(error: Exception) -> None:
    if isinstance(error, ReviewNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    if isinstance(error, ReviewParticipationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only contract participants can review this contract",
        )
    if isinstance(error, ContractNotCompletedError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contracts can only be reviewed after completion",
        )
    if isinstance(error, DuplicateReviewError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this contract",
        )
    raise error


@router.post("/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review_endpoint(
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # participants review each other once, only after the contract is completed
        return create_review(db, current_user.id, data)
    except (
        ReviewNotFoundError,
        ReviewParticipationError,
        ContractNotCompletedError,
        DuplicateReviewError,
    ) as error:
        _raise_review_http_error(error)


@router.get("/users/{user_id}/reviews", response_model=list[ReviewOut])
def list_user_reviews_endpoint(
    user_id: int,
    db: Session = Depends(get_db),
):
    # public endpoint: reputation trails are visible without authentication
    return get_reviews_for_user(db, user_id)


@router.get("/users/{user_id}/reviews/average")
def user_average_rating_endpoint(
    user_id: int,
    db: Session = Depends(get_db),
):
    # public aggregate reputation score; null when the user has no reviews yet
    return {"user_id": user_id, "average_rating": calculate_average_rating(db, user_id)}
