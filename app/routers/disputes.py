from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.dispute import DisputeCreate, DisputeOut, DisputeResolve
from app.services.dispute_service import (
    AdminPermissionError,
    ContractNotFoundError,
    DisputeNotOpenError,
    DisputeNotFoundError,
    DisputeNotUnderReviewError,
    DisputeParticipationError,
    create_dispute,
    get_dispute,
    list_open_disputes,
    resolve_dispute,
    start_review,
)


# expose dispute actions under one resource router
router = APIRouter(tags=["disputes"])


# convert dispute-domain failures into stable, safe HTTP responses at the API boundary
def _raise_dispute_http_error(error: Exception) -> None:
    if isinstance(error, ContractNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    if isinstance(error, DisputeNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")
    if isinstance(error, DisputeParticipationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only contract participants can open a dispute",
        )
    if isinstance(error, AdminPermissionError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can perform this action",
        )
    if isinstance(error, DisputeNotOpenError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only open disputes can enter review",
        )
    if isinstance(error, DisputeNotUnderReviewError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only disputes under review can be resolved",
        )
    raise error


@router.post("/disputes", response_model=DisputeOut, status_code=status.HTTP_201_CREATED)
def create_dispute_endpoint(
    data: DisputeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # only the two contract parties may escalate a contract to moderation
        return create_dispute(db, current_user.id, data)
    except (ContractNotFoundError, DisputeParticipationError) as error:
        _raise_dispute_http_error(error)


@router.get("/disputes", response_model=list[DisputeOut])
def list_disputes_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    # admin-only moderation queue; the role comes from the verified token
    return list_open_disputes(db)


@router.get("/disputes/{dispute_id}", response_model=DisputeOut)
def get_dispute_endpoint(
    dispute_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dispute = get_dispute(db, dispute_id)
    if dispute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")

    # visibility depends on who is asking: admins moderate everything,
    # participants see disputes on their own contracts
    contract = dispute.contract
    is_admin = current_user.role == UserRole.ADMIN
    is_participant = current_user.id in (contract.client_id, contract.freelancer_id)
    if not (is_admin or is_participant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only contract participants or admins can view this dispute",
        )
    return dispute


@router.post("/disputes/{dispute_id}/start-review", response_model=DisputeOut)
def start_review_endpoint(
    dispute_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    try:
        # admins pick disputes up from the queue into active review
        return start_review(db, dispute_id, current_user.id)
    except (DisputeNotFoundError, AdminPermissionError, DisputeNotOpenError) as error:
        _raise_dispute_http_error(error)


@router.post("/disputes/{dispute_id}/resolve", response_model=DisputeOut)
def resolve_dispute_endpoint(
    dispute_id: int,
    data: DisputeResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    try:
        # admins close disputes under review with a recorded final decision
        return resolve_dispute(db, dispute_id, current_user.id, data)
    except (DisputeNotFoundError, AdminPermissionError, DisputeNotUnderReviewError) as error:
        _raise_dispute_http_error(error)
