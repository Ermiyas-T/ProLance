from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.proposal import ProposalStatus
from app.models.user import User, UserRole
from app.schemas.contract import ContractOut
from app.schemas.proposal import ProposalCreate, ProposalListOut, ProposalOut
from app.services.contract_service import (
    ContractNotFoundError,
    ContractParticipationError,
    InvalidContractStateError,
    ProjectAlreadyContractedError,
    accept_proposal,
)
from app.services.contract_service import (
    InvalidProposalStateError as ContractInvalidProposalStateError,
)
from app.services.contract_service import (
    ProjectOwnershipError as ContractProjectOwnershipError,
)
from app.services.contract_service import (
    ProposalNotFoundError as ContractProposalNotFoundError,
)
from app.services.proposal_service import (
    DuplicateProposalError,
    InvalidProjectStateError,
    InvalidProposalStateError,
    ProjectNotFoundError,
    ProposalNotFoundError,
    ProposalOwnershipError,
    SelfProposalError,
    create_proposal,
    get_authorized_proposal,
    list_proposals_by_freelancer,
    list_proposals_for_project,
    withdraw_proposal,
)

# expose freelancer proposal actions under one resource router
router = APIRouter(prefix="/proposals", tags=["proposals"])


# convert proposal-domain failures into stable, safe HTTP responses at the API boundary
def _raise_proposal_http_error(error: Exception) -> None:
    if isinstance(error, ProposalNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found"
        )
    if isinstance(error, ProjectNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    if isinstance(error, ProposalOwnershipError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not the proposal owner"
        )
    if isinstance(error, InvalidProposalStateError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Proposal action is not allowed in its current status",
        )
    if isinstance(error, InvalidProjectStateError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project is not open for proposals",
        )
    if isinstance(error, SelfProposalError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot submit proposal on your own project",
        )
    if isinstance(error, DuplicateProposalError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending proposal on this project",
        )
    raise error


@router.post("", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
def create_proposal_endpoint(
    data: ProposalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FREELANCER)),
):
    try:
        # bind the new proposal to the verified freelancer identity
        return create_proposal(db, current_user.id, data)
    except (
        ProjectNotFoundError,
        InvalidProjectStateError,
        SelfProposalError,
        DuplicateProposalError,
    ) as error:
        _raise_proposal_http_error(error)


@router.get("", response_model=ProposalListOut)
def list_own_proposals_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # use database-level pagination to keep the response fast as history grows
    proposals, total = list_proposals_by_freelancer(
        db, current_user.id, page, page_size
    )

    # convert SQLAlchemy models to Pydantic models for type safety
    proposal_outs = [ProposalOut.model_validate(proposal) for proposal in proposals]

    return ProposalListOut(
        items=proposal_outs, total=total, page=page, page_size=page_size
    )


@router.get("/{proposal_id}", response_model=ProposalOut)
def get_proposal_endpoint(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # object-level authorization is handled in the service layer
        return get_authorized_proposal(db, proposal_id, current_user.id)
    except (ProposalNotFoundError, ProposalOwnershipError) as error:
        _raise_proposal_http_error(error)


@router.post("/{proposal_id}/withdraw", response_model=ProposalOut)
def withdraw_proposal_endpoint(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FREELANCER)),
):
    try:
        # only the freelancer who submitted the proposal can withdraw it
        return withdraw_proposal(db, proposal_id, current_user.id)
    except (
        ProposalNotFoundError,
        ProposalOwnershipError,
        InvalidProposalStateError,
    ) as error:
        _raise_proposal_http_error(error)


@router.post("/{proposal_id}/accept", response_model=ContractOut)
def accept_proposal_endpoint(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    try:
        # only the project owner can accept proposals for their project
        return accept_proposal(db, proposal_id, current_user.id)
    except (
        ContractProposalNotFoundError,
        ContractInvalidProposalStateError,
        ContractProjectOwnershipError,
        ProjectAlreadyContractedError,
    ) as error:
        if isinstance(error, ContractProposalNotFoundError):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found"
            )
        if isinstance(error, ContractProjectOwnershipError):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not the project owner"
            )
        if isinstance(error, ContractInvalidProposalStateError):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Proposal is not in a state that can be accepted",
            )
        if isinstance(error, ProjectAlreadyContractedError):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Project already has an active contract",
            )
        raise error
