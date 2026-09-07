from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.deliverable import (
    DeliverableApprove,
    DeliverableOut,
    DeliverableRevisionRequest,
    DeliverableSubmit,
)
from app.services.deliverable_service import (
    ContractNotActiveError,
    DeliverableNotFoundError,
    DeliverableParticipationError,
    InvalidDeliverableStateError,
    NotContractClientError,
    NotContractFreelancerError,
    approve_deliverable,
    get_deliverable,
    list_deliverables,
    request_revision,
    submit_deliverable,
)


# expose deliverable actions under one resource router
router = APIRouter(tags=["deliverables"])


# convert deliverable-domain failures into stable, safe HTTP responses at the API boundary
def _raise_deliverable_http_error(error: Exception) -> None:
    if isinstance(error, DeliverableNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    if isinstance(error, DeliverableParticipationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this contract"
        )
    if isinstance(error, NotContractFreelancerError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the contract freelancer can submit deliverables"
        )
    if isinstance(error, NotContractClientError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the contract client can review deliverables"
        )
    if isinstance(error, ContractNotActiveError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Deliverables can only be submitted while the contract is active",
        )
    if isinstance(error, InvalidDeliverableStateError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Deliverable is not in a state that allows this action",
        )
    raise error


@router.post(
    "/contracts/{contract_id}/deliverables",
    response_model=DeliverableOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_deliverable_endpoint(
    contract_id: int,
    data: DeliverableSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # only the contract freelancer can submit work for review
        return submit_deliverable(db, contract_id, current_user.id, data)
    except (
        DeliverableNotFoundError,
        DeliverableParticipationError,
        NotContractFreelancerError,
        ContractNotActiveError,
    ) as error:
        _raise_deliverable_http_error(error)


@router.get("/contracts/{contract_id}/deliverables", response_model=list[DeliverableOut])
def list_deliverables_endpoint(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # participants can see the full version trail for their contract
        return list_deliverables(db, contract_id, current_user.id)
    except (DeliverableNotFoundError, DeliverableParticipationError) as error:
        _raise_deliverable_http_error(error)


@router.get("/deliverables/{deliverable_id}", response_model=DeliverableOut)
def get_deliverable_endpoint(
    deliverable_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # retrieve the deliverable
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")

    # object-level authorization: verify requester participates in the deliverable's contract
    try:
        _ = list_deliverables(db, deliverable.contract_id, current_user.id)
    except (DeliverableNotFoundError, DeliverableParticipationError) as error:
        _raise_deliverable_http_error(error)

    return deliverable


@router.post("/deliverables/{deliverable_id}/approve", response_model=DeliverableOut)
def approve_deliverable_endpoint(
    deliverable_id: int,
    data: DeliverableApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # only the contract client can approve, cascading contract and project to COMPLETED
        return approve_deliverable(db, deliverable_id, current_user.id)
    except (
        DeliverableNotFoundError,
        DeliverableParticipationError,
        NotContractClientError,
        InvalidDeliverableStateError,
    ) as error:
        _raise_deliverable_http_error(error)


@router.post(
    "/deliverables/{deliverable_id}/request-revision",
    response_model=DeliverableOut,
)
def request_revision_endpoint(
    deliverable_id: int,
    data: DeliverableRevisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # only the contract client can request revisions, reopening the contract
        return request_revision(db, deliverable_id, current_user.id, data)
    except (
        DeliverableNotFoundError,
        DeliverableParticipationError,
        NotContractClientError,
        InvalidDeliverableStateError,
    ) as error:
        _raise_deliverable_http_error(error)
