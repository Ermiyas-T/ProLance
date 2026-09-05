from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.project import Project, ProjectStatus
from app.models.proposal import Proposal, ProposalStatus
from app.models.user import User
from app.schemas.proposal import ProposalCreate


# keep missing-resource outcomes distinct from failed ownership checks at the HTTP boundary
class ProposalNotFoundError(Exception):
    pass


# prevent authenticated freelancers from withdrawing proposals they don't own
class ProposalOwnershipError(Exception):
    pass


# expose invalid lifecycle action attempts without allowing arbitrary status assignments
class InvalidProposalStateError(Exception):
    pass


# prevent proposals on projects that are not open for bidding
class InvalidProjectStateError(Exception):
    pass


# prevent freelancers from bidding on their own projects
class SelfProposalError(Exception):
    pass


# prevent duplicate active proposals from the same freelancer on the same project
class DuplicateProposalError(Exception):
    pass


# prevent proposals on non-existent projects
class ProjectNotFoundError(Exception):
    pass


# retrieve a proposal by primary key
def get_proposal(db: Session, proposal_id: int) -> Proposal | None:
    return db.get(Proposal, proposal_id)


# retrieve a project by primary key
def _get_project(db: Session, project_id: int) -> Project | None:
    return db.get(Project, project_id)


# verify the project exists and is open for proposals
def _validate_project_for_proposal(db: Session, project_id: int) -> Project:
    project = _get_project(db, project_id)
    if project is None:
        raise ProjectNotFoundError
    if project.status != ProjectStatus.OPEN:
        raise InvalidProjectStateError
    return project


# check if the freelancer already has a pending proposal on this project
def _check_duplicate_proposal(db: Session, project_id: int, freelancer_id: int) -> None:
    existing_proposal = db.scalar(
        select(Proposal).where(
            Proposal.project_id == project_id,
            Proposal.freelancer_id == freelancer_id,
            Proposal.status == ProposalStatus.PENDING,
        )
    )
    if existing_proposal is not None:
        raise DuplicateProposalError


# create a new proposal on behalf of a freelancer
def create_proposal(db: Session, freelancer_id: int, data: ProposalCreate) -> Proposal:
    # validate the project exists and is open
    project = _validate_project_for_proposal(db, data.project_id)

    # prevent freelancers from bidding on their own projects
    if project.owner_id == freelancer_id:
        raise SelfProposalError

    # check for duplicate pending proposals
    _check_duplicate_proposal(db, data.project_id, freelancer_id)

    # create the proposal with PENDING status
    proposal = Proposal(
        project_id=data.project_id,
        freelancer_id=freelancer_id,
        proposed_price=data.proposed_price,
        delivery_days=data.delivery_days,
        cover_letter=data.cover_letter,
        status=ProposalStatus.PENDING,
    )

    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


# verify the proposal exists and belongs to the requesting freelancer
def _get_owned_proposal(db: Session, proposal_id: int, freelancer_id: int) -> Proposal:
    proposal = get_proposal(db, proposal_id)
    if proposal is None:
        raise ProposalNotFoundError
    if proposal.freelancer_id != freelancer_id:
        raise ProposalOwnershipError
    return proposal


# list all proposals for a specific project (only for project owner)
def list_proposals_for_project(db: Session, project_id: int, owner_id: int) -> list[Proposal]:
    # verify the project exists and belongs to the requester
    project = _get_project(db, project_id)
    if project is None:
        raise ProjectNotFoundError
    if project.owner_id != owner_id:
        raise ProposalOwnershipError

    # return all proposals for this project
    statement = select(Proposal).where(Proposal.project_id == project_id)
    return list(db.scalars(statement).all())


# list all proposals submitted by a specific freelancer
def list_proposals_by_freelancer(db: Session, freelancer_id: int) -> list[Proposal]:
    statement = select(Proposal).where(Proposal.freelancer_id == freelancer_id)
    return list(db.scalars(statement).all())


# withdraw a pending proposal (only by the freelancer who submitted it)
def withdraw_proposal(db: Session, proposal_id: int, freelancer_id: int) -> Proposal:
    # verify ownership
    proposal = _get_owned_proposal(db, proposal_id, freelancer_id)

    # only pending proposals can be withdrawn
    if proposal.status != ProposalStatus.PENDING:
        raise InvalidProposalStateError

    # change status to WITHDRAWN
    proposal.status = ProposalStatus.WITHDRAWN
    db.commit()
    db.refresh(proposal)
    return proposal
