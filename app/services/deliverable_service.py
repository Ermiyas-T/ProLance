from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contract import Contract, ContractStatus
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.project import Project, ProjectStatus
from app.schemas.deliverable import DeliverableRevisionRequest, DeliverableSubmit


# keep missing-resource outcomes distinct from failed ownership checks at the HTTP boundary
class DeliverableNotFoundError(Exception):
    pass


# prevent authenticated users from touching deliverables on contracts they're not part of
class DeliverableParticipationError(Exception):
    pass


# expose invalid lifecycle action attempts without allowing arbitrary status assignments
class InvalidDeliverableStateError(Exception):
    pass


# prevent submissions on contracts that are not active
class ContractNotActiveError(Exception):
    pass


# prevent non-freelancer contract participants from submitting deliverables
class NotContractFreelancerError(Exception):
    pass


# prevent non-client contract participants from reviewing deliverables
class NotContractClientError(Exception):
    pass


# verify the contract exists and the requester is a participant
def _get_participant_contract(db: Session, contract_id: int, user_id: int) -> Contract:
    contract = db.get(Contract, contract_id)
    if contract is None:
        raise DeliverableNotFoundError
    if contract.client_id != user_id and contract.freelancer_id != user_id:
        raise DeliverableParticipationError
    return contract


# submit a new deliverable version and move the contract to DELIVERED atomically
def submit_deliverable(db: Session, contract_id: int, user_id: int, data: DeliverableSubmit) -> Deliverable:
    # verify the contract exists and the requester is a participant
    contract = _get_participant_contract(db, contract_id, user_id)

    # only the freelancer can submit work on their own contract
    if contract.freelancer_id != user_id:
        raise NotContractFreelancerError

    # only active contracts accept submissions; revision requests reopen the contract first
    if contract.status != ContractStatus.ACTIVE:
        raise ContractNotActiveError

    # begin the atomic transaction - all operations must succeed or all fail
    try:
        # find the latest version so the new submission appends to the revision trail
        latest_version = db.scalar(
            select(Deliverable.version_number)
            .where(Deliverable.contract_id == contract_id)
            .order_by(Deliverable.version_number.desc())
            .limit(1)
        )

        # create the deliverable as the next immutable version, starting at 1
        deliverable = Deliverable(
            contract_id=contract_id,
            submitted_by=user_id,
            version_number=(latest_version or 0) + 1,
            message=data.message,
            file_url=data.file_url,
            status=DeliverableStatus.SUBMITTED,
        )
        db.add(deliverable)

        # cascade the contract into the delivered state awaiting client review
        contract.status = ContractStatus.DELIVERED

        # commit the transaction - submission and contract cascade are atomic
        db.commit()
        db.refresh(deliverable)
        return deliverable

    except Exception:
        # rollback on any failure to maintain database consistency
        db.rollback()
        raise


# list the full version trail for a contract, verifying requester participation
def list_deliverables(db: Session, contract_id: int, user_id: int) -> list[Deliverable]:
    # verify requester is a participant in this contract
    _get_participant_contract(db, contract_id, user_id)

    # return the trail ordered by version so revisions read chronologically
    statement = (
        select(Deliverable)
        .where(Deliverable.contract_id == contract_id)
        .order_by(Deliverable.version_number)
    )
    return list(db.scalars(statement).all())


# retrieve a deliverable by primary key
def get_deliverable(db: Session, deliverable_id: int) -> Deliverable | None:
    return db.get(Deliverable, deliverable_id)


# verify the deliverable exists and the requester participates in its contract
def _get_participant_deliverable(
    db: Session, deliverable_id: int, user_id: int
) -> tuple[Deliverable, Contract]:
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise DeliverableNotFoundError
    contract = _get_participant_contract(db, deliverable.contract_id, user_id)
    return deliverable, contract


# approve a submitted deliverable and cascade contract and project to COMPLETED atomically
def approve_deliverable(db: Session, deliverable_id: int, client_id: int) -> Deliverable:
    # verify the deliverable exists and the requester is a participant
    deliverable, contract = _get_participant_deliverable(db, deliverable_id, client_id)

    # only the client can approve work they are buying
    if contract.client_id != client_id:
        raise NotContractClientError

    # guard the only legal transition: SUBMITTED -> APPROVED
    if deliverable.status != DeliverableStatus.SUBMITTED:
        raise InvalidDeliverableStateError

    # retrieve the project so the completion cascade reaches it too
    project = db.get(Project, contract.project_id)
    if project is None:
        raise DeliverableNotFoundError

    # begin the atomic transaction - all operations must succeed or all fail
    try:
        # approve the deliverable version under review
        deliverable.status = DeliverableStatus.APPROVED

        # cascade the contract to its terminal completed state
        contract.status = ContractStatus.COMPLETED

        # cascade the project to completed so the marketplace lifecycle closes
        project.status = ProjectStatus.COMPLETED

        # commit the transaction - the three-entity cascade is atomic
        db.commit()
        db.refresh(deliverable)
        return deliverable

    except Exception:
        # rollback on any failure to maintain database consistency
        db.rollback()
        raise


# request a revision on a submitted deliverable and move the contract back to ACTIVE
def request_revision(
    db: Session, deliverable_id: int, client_id: int, data: DeliverableRevisionRequest
) -> Deliverable:
    # verify the deliverable exists and the requester is a participant
    deliverable, contract = _get_participant_deliverable(db, deliverable_id, client_id)

    # only the client can request revisions on work they are buying
    if contract.client_id != client_id:
        raise NotContractClientError

    # guard the only legal transition: SUBMITTED -> REVISION_REQUESTED
    if deliverable.status != DeliverableStatus.SUBMITTED:
        raise InvalidDeliverableStateError

    # begin the atomic transaction - all operations must succeed or all fail
    try:
        # mark the version as needing rework and store the client's feedback
        deliverable.status = DeliverableStatus.REVISION_REQUESTED
        deliverable.revision_notes = data.revision_notes

        # reopen the contract so the freelancer can submit the next version
        contract.status = ContractStatus.ACTIVE

        # commit the transaction - review outcome and contract cascade are atomic
        db.commit()
        db.refresh(deliverable)
        return deliverable

    except Exception:
        # rollback on any failure to maintain database consistency
        db.rollback()
        raise
