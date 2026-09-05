from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contract import Contract, ContractStatus
from app.models.project import Project, ProjectStatus
from app.models.proposal import Proposal, ProposalStatus
from app.models.user import User


# keep missing-resource outcomes distinct from failed ownership checks at the HTTP boundary
class ContractNotFoundError(Exception):
    pass


# prevent authenticated users from accessing contracts they're not part of
class ContractParticipationError(Exception):
    pass


# expose invalid lifecycle action attempts without allowing arbitrary status assignments
class InvalidContractStateError(Exception):
    pass


# prevent proposal acceptance on proposals that are not pending
class InvalidProposalStateError(Exception):
    pass


# prevent contract creation on projects that already have a contract
class ProjectAlreadyContractedError(Exception):
    pass


# prevent users from accepting proposals on projects they don't own
class ProjectOwnershipError(Exception):
    pass


# prevent proposal acceptance on proposals that don't exist
class ProposalNotFoundError(Exception):
    pass


# retrieve a contract by primary key
def get_contract(db: Session, contract_id: int) -> Contract | None:
    return db.get(Contract, contract_id)


# retrieve a proposal by primary key
def _get_proposal(db: Session, proposal_id: int) -> Proposal | None:
    return db.get(Proposal, proposal_id)


# retrieve a project by primary key
def _get_project(db: Session, project_id: int) -> Project | None:
    return db.get(Project, project_id)


# verify the contract exists and the requester is a participant
def _get_participant_contract(db: Session, contract_id: int, user_id: int) -> Contract:
    contract = get_contract(db, contract_id)
    if contract is None:
        raise ContractNotFoundError
    if contract.client_id != user_id and contract.freelancer_id != user_id:
        raise ContractParticipationError
    return contract


# accept a proposal and create contract in a single atomic transaction
def accept_proposal(db: Session, proposal_id: int, client_id: int) -> Contract:
    # retrieve the proposal and verify it exists
    proposal = _get_proposal(db, proposal_id)
    if proposal is None:
        raise ProposalNotFoundError

    # verify the proposal is still pending
    if proposal.status != ProposalStatus.PENDING:
        raise InvalidProposalStateError

    # retrieve the project and verify the requester is the owner
    project = _get_project(db, proposal.project_id)
    if project is None:
        raise ProposalNotFoundError
    if project.owner_id != client_id:
        raise ProjectOwnershipError

    # verify the project doesn't already have a contract
    existing_contract = db.scalar(
        select(Contract).where(Contract.project_id == project.id)
    )
    if existing_contract is not None:
        raise ProjectAlreadyContractedError

    # begin the atomic transaction - all operations must succeed or all fail
    try:
        # accept the chosen proposal
        proposal.status = ProposalStatus.ACCEPTED

        # reject all other pending proposals for this project
        other_pending_proposals = db.scalars(
            select(Proposal).where(
                Proposal.project_id == project.id,
                Proposal.status == ProposalStatus.PENDING,
                Proposal.id != proposal_id,
            )
        ).all()
        for other_proposal in other_pending_proposals:
            other_proposal.status = ProposalStatus.REJECTED

        # create the contract with derived participant IDs
        contract = Contract(
            project_id=project.id,
            proposal_id=proposal.id,
            client_id=project.owner_id,
            freelancer_id=proposal.freelancer_id,
            agreed_price=proposal.proposed_price,
            deadline=project.deadline,
            status=ContractStatus.ACTIVE,
        )
        db.add(contract)

        # move the project to IN_PROGRESS
        project.status = ProjectStatus.IN_PROGRESS

        # commit the transaction - all changes are atomic
        db.commit()
        db.refresh(contract)
        return contract

    except Exception:
        # rollback on any failure to maintain database consistency
        db.rollback()
        raise


# list contracts for a user (as client or freelancer)
def list_contracts_for_user(db: Session, user_id: int) -> list[Contract]:
    statement = select(Contract).where(
        (Contract.client_id == user_id) | (Contract.freelancer_id == user_id)
    )
    return list(db.scalars(statement).all())


# cancel an active contract (only by participants)
def cancel_contract(db: Session, contract_id: int, user_id: int) -> Contract:
    # verify the contract exists and the requester is a participant
    contract = _get_participant_contract(db, contract_id, user_id)

    # only active contracts can be cancelled
    if contract.status != ContractStatus.ACTIVE:
        raise InvalidContractStateError

    # retrieve the project to update its status
    project = _get_project(db, contract.project_id)
    if project is None:
        raise ContractNotFoundError

    # begin the atomic transaction
    try:
        # cancel the contract
        contract.status = ContractStatus.CANCELLED

        # move the project to CANCELLED
        project.status = ProjectStatus.CANCELLED

        # commit the transaction
        db.commit()
        db.refresh(contract)
        return contract

    except Exception:
        # rollback on any failure
        db.rollback()
        raise


# complete a contract (V1: explicit completion, deliverable approval in Stage 8)
def complete_contract(db: Session, contract_id: int) -> Contract:
    # retrieve the contract
    contract = get_contract(db, contract_id)
    if contract is None:
        raise ContractNotFoundError

    # only active or delivered contracts can be completed
    if contract.status not in {ContractStatus.ACTIVE, ContractStatus.DELIVERED}:
        raise InvalidContractStateError

    # retrieve the project to update its status
    project = _get_project(db, contract.project_id)
    if project is None:
        raise ContractNotFoundError

    # begin the atomic transaction
    try:
        # complete the contract
        contract.status = ContractStatus.COMPLETED

        # move the project to COMPLETED
        project.status = ProjectStatus.COMPLETED

        # commit the transaction
        db.commit()
        db.refresh(contract)
        return contract

    except Exception:
        # rollback on any failure
        db.rollback()
        raise
