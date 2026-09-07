from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.dispute import Dispute, DisputeStatus
from app.models.user import User, UserRole


# keep missing resources distinct from failed permission checks at the HTTP boundary
class ContractNotFoundError(Exception):
    pass


class DisputeNotFoundError(Exception):
    pass


# prevent users who are not contract participants from opening disputes
class DisputeParticipationError(Exception):
    pass


# admin-only mutations must fail loudly when a non-admin reaches the service
class AdminPermissionError(Exception):
    pass


# expose attempts to start review on a dispute that is not freshly open
class DisputeNotOpenError(Exception):
    pass


# expose attempts to resolve a dispute that has not entered review yet
class DisputeNotUnderReviewError(Exception):
    pass


# both admin mutations verify the role at the service layer as defense in depth
def _ensure_admin(db: Session, admin_id: int) -> None:
    user = db.get(User, admin_id)
    if user is None or user.role != UserRole.ADMIN:
        raise AdminPermissionError


# open a dispute on a contract on behalf of one of its participants
def create_dispute(db: Session, user_id: int, data) -> Dispute:
    # retrieve the contract the dispute concerns
    contract = db.get(Contract, data.contract_id)
    if contract is None:
        raise ContractNotFoundError

    # only the two contract parties may escalate a contract to moderation
    if user_id not in (contract.client_id, contract.freelancer_id):
        raise DisputeParticipationError

    try:
        # new disputes always begin in the admin intake state
        dispute = Dispute(
            contract_id=contract.id,
            opened_by=user_id,
            title=data.title,
            description=data.description,
            status=DisputeStatus.OPEN,
        )
        db.add(dispute)
        db.commit()
        db.refresh(dispute)
        return dispute
    except Exception:
        # rollback on any failure to maintain database consistency
        db.rollback()
        raise


# fetch one dispute by id; visibility is enforced by the router based on the requester
def get_dispute(db: Session, dispute_id: int) -> Dispute | None:
    return db.get(Dispute, dispute_id)


# list the admin moderation queue: every dispute still awaiting action, newest first
def list_open_disputes(db: Session) -> list[Dispute]:
    statement = (
        select(Dispute)
        .where(Dispute.status != DisputeStatus.RESOLVED)
        .order_by(Dispute.created_at.desc(), Dispute.id.desc())
    )
    return list(db.scalars(statement).all())


# move an open dispute into the admin's active review state
def start_review(db: Session, dispute_id: int, admin_id: int) -> Dispute:
    _ensure_admin(db, admin_id)

    dispute = db.get(Dispute, dispute_id)
    if dispute is None:
        raise DisputeNotFoundError

    # only freshly opened disputes can enter review; resolved ones are final
    if dispute.status != DisputeStatus.OPEN:
        raise DisputeNotOpenError

    try:
        dispute.status = DisputeStatus.UNDER_REVIEW
        db.commit()
        db.refresh(dispute)
        return dispute
    except Exception:
        # rollback on any failure to maintain database consistency
        db.rollback()
        raise


# close a dispute under review with the admin's final decision
def resolve_dispute(db: Session, dispute_id: int, admin_id: int, data) -> Dispute:
    _ensure_admin(db, admin_id)

    dispute = db.get(Dispute, dispute_id)
    if dispute is None:
        raise DisputeNotFoundError

    # the workflow requires a dispute to be under review before it can be resolved
    if dispute.status != DisputeStatus.UNDER_REVIEW:
        raise DisputeNotUnderReviewError

    try:
        dispute.status = DisputeStatus.RESOLVED
        dispute.resolution = data.resolution
        # record which admin made the decision for accountability
        dispute.resolved_by = admin_id
        db.commit()
        db.refresh(dispute)
        return dispute
    except Exception:
        # rollback on any failure to maintain database consistency
        db.rollback()
        raise
