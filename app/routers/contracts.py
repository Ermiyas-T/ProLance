from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.contract import ContractStatus
from app.models.user import User, UserRole
from app.schemas.contract import ContractListOut, ContractOut
from app.services.contract_service import (
    ContractNotFoundError,
    ContractParticipationError,
    InvalidContractStateError,
    InvalidProposalStateError,
    ProjectAlreadyContractedError,
    ProjectOwnershipError,
    ProposalNotFoundError,
    accept_proposal,
    cancel_contract,
    complete_contract,
    get_contract,
    list_contracts_for_user,
)


# expose contract actions under one resource router
router = APIRouter(prefix="/contracts", tags=["contracts"])


# convert contract-domain failures into stable, safe HTTP responses at the API boundary
def _raise_contract_http_error(error: Exception) -> None:
    if isinstance(error, ContractNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    if isinstance(error, ProposalNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if isinstance(error, ContractParticipationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this contract"
        )
    if isinstance(error, ProjectOwnershipError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the project owner")
    if isinstance(error, InvalidContractStateError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract action is not allowed in its current status",
        )
    if isinstance(error, InvalidProposalStateError):
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


@router.post("/proposals/{proposal_id}/accept", response_model=ContractOut)
def accept_proposal_endpoint(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    try:
        # only the project owner can accept proposals for their project
        return accept_proposal(db, proposal_id, current_user.id)
    except (
        ProposalNotFoundError,
        InvalidProposalStateError,
        ProjectOwnershipError,
        ProjectAlreadyContractedError,
    ) as error:
        _raise_contract_http_error(error)


@router.get("", response_model=ContractListOut)
def list_contracts_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # users can see contracts where they are client or freelancer
    all_contracts = list_contracts_for_user(db, current_user.id)

    # apply pagination to the results
    total = len(all_contracts)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_contracts = all_contracts[start:end]

    # convert SQLAlchemy models to Pydantic models for type safety
    contract_outs = [ContractOut.model_validate(contract) for contract in paginated_contracts]

    return ContractListOut(
        items=contract_outs, total=total, page=page, page_size=page_size
    )


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract_endpoint(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # retrieve the contract
    contract = get_contract(db, contract_id)
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    # object-level authorization: only participants can view the contract
    if contract.client_id != current_user.id and contract.freelancer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this contract"
        )

    return contract


@router.post("/{contract_id}/cancel", response_model=ContractOut)
def cancel_contract_endpoint(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # only contract participants can cancel the contract
        return cancel_contract(db, contract_id, current_user.id)
    except (ContractNotFoundError, ContractParticipationError, InvalidContractStateError) as error:
        _raise_contract_http_error(error)


@router.post("/{contract_id}/complete", response_model=ContractOut)
def complete_contract_endpoint(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # retrieve the contract to verify participation
        contract = get_contract(db, contract_id)
        if contract is None:
            raise ContractNotFoundError

        # only contract participants can complete the contract
        if contract.client_id != current_user.id and contract.freelancer_id != current_user.id:
            raise ContractParticipationError

        return complete_contract(db, contract_id)
    except (ContractNotFoundError, ContractParticipationError, InvalidContractStateError) as error:
        _raise_contract_http_error(error)
