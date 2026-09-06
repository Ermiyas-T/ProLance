from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models.contract import ContractStatus
from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.user import User
from app.services.contract_service import (
    ContractParticipationError,
    InvalidContractStateError,
    InvalidProposalStateError,
    ProjectAlreadyContractedError,
    ProjectOwnershipError,
    accept_proposal,
    cancel_contract,
    complete_contract,
    list_contracts_for_user,
)
from helpers import make_contract, make_project, make_proposal


def test_accept_proposal_creates_contract_and_rejects_competing_bids(
    db: Session,
    client_user: User,
    freelancer_user: User,
    other_freelancer_user: User,
) -> None:
    # accepting a proposal updates proposal, competitors, contract, and project atomically
    project = make_project(db, client_user.id, ProjectStatus.OPEN)
    accepted_proposal = make_proposal(
        db, project.id, freelancer_user.id, price=Decimal("700.00")
    )
    competing_proposal = make_proposal(
        db, project.id, other_freelancer_user.id, price=Decimal("900.00")
    )

    contract = accept_proposal(db, accepted_proposal.id, client_user.id)
    db.refresh(accepted_proposal)
    db.refresh(competing_proposal)
    db.refresh(project)

    assert contract.status == ContractStatus.ACTIVE
    assert contract.client_id == client_user.id
    assert contract.freelancer_id == freelancer_user.id
    assert contract.agreed_price == Decimal("700.00")
    assert accepted_proposal.status == ProposalStatus.ACCEPTED
    assert competing_proposal.status == ProposalStatus.REJECTED
    assert project.status == ProjectStatus.IN_PROGRESS


def test_accept_proposal_requires_owner_pending_proposal_and_single_contract(
    db: Session,
    client_user: User,
    other_client_user: User,
    freelancer_user: User,
) -> None:
    # reject acceptance attempts by clients who do not own the project
    project = make_project(db, client_user.id, ProjectStatus.OPEN)
    proposal = make_proposal(db, project.id, freelancer_user.id)
    with pytest.raises(ProjectOwnershipError):
        accept_proposal(db, proposal.id, other_client_user.id)

    # reject proposals that already left the pending state
    proposal.status = ProposalStatus.WITHDRAWN
    db.commit()
    with pytest.raises(InvalidProposalStateError):
        accept_proposal(db, proposal.id, client_user.id)

    # reject a second contract for the same project
    proposal.status = ProposalStatus.PENDING
    db.commit()
    make_contract(db, project, proposal)
    with pytest.raises(ProjectAlreadyContractedError):
        accept_proposal(db, proposal.id, client_user.id)


def test_contract_listing_and_lifecycle_require_participation(
    db: Session,
    client_user: User,
    other_client_user: User,
    freelancer_user: User,
) -> None:
    # seed one active contract between a client and freelancer
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)

    assert [item.id for item in list_contracts_for_user(db, client_user.id)] == [contract.id]
    assert [item.id for item in list_contracts_for_user(db, freelancer_user.id)] == [contract.id]
    assert list_contracts_for_user(db, other_client_user.id) == []

    # unrelated users cannot cancel participant contracts
    with pytest.raises(ContractParticipationError):
        cancel_contract(db, contract.id, other_client_user.id)

    # participants can cancel an active contract and mirror the project state
    cancelled = cancel_contract(db, contract.id, freelancer_user.id)
    db.refresh(project)

    assert cancelled.status == ContractStatus.CANCELLED
    assert project.status == ProjectStatus.CANCELLED

    # terminal contracts cannot be completed afterward
    with pytest.raises(InvalidContractStateError):
        complete_contract(db, contract.id)


def test_complete_contract_moves_active_work_to_completed(
    db: Session,
    client_user: User,
    freelancer_user: User,
) -> None:
    # completing a contract also closes the associated project
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)

    completed = complete_contract(db, contract.id)
    db.refresh(project)

    assert completed.status == ContractStatus.COMPLETED
    assert project.status == ProjectStatus.COMPLETED
