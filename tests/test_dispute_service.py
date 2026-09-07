import pytest
from sqlalchemy.orm import Session

from app.models.dispute import DisputeStatus
from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.user import User
from app.schemas.dispute import DisputeCreate, DisputeResolve
from app.services.dispute_service import (
    AdminPermissionError,
    ContractNotFoundError,
    DisputeNotFoundError,
    DisputeNotOpenError,
    DisputeNotUnderReviewError,
    DisputeParticipationError,
    create_dispute,
    get_dispute,
    list_open_disputes,
    resolve_dispute,
    start_review,
)
from helpers import make_contract, make_project, make_proposal

# shared request payloads so each test only customizes what it exercises
CREATE_PAYLOAD = DisputeCreate(
    contract_id=0,
    title="Work not delivered",
    description="The freelancer stopped responding two weeks ago.",
)
RESOLVE_PAYLOAD = DisputeResolve(resolution="Partial refund issued to the client.")


def make_active_contract(db: Session, client_user: User, freelancer_user: User):
    # seed a contract between the two default participants for dispute tests
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    return make_contract(db, project, proposal)


def test_create_dispute_records_participant_and_open_status(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # a client escalates their own contract
    contract = make_active_contract(db, client_user, freelancer_user)

    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    dispute = create_dispute(db, client_user.id, data)

    assert dispute.id is not None
    assert dispute.contract_id == contract.id
    assert dispute.opened_by == client_user.id
    assert dispute.status == DisputeStatus.OPEN
    assert dispute.resolution is None
    assert dispute.resolved_by is None


def test_create_dispute_accepts_both_contract_parties(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # bilateral escalation: the freelancer may raise a dispute just as well
    contract = make_active_contract(db, client_user, freelancer_user)

    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    dispute = create_dispute(db, freelancer_user.id, data)

    assert dispute.opened_by == freelancer_user.id


def test_create_dispute_rejects_non_participants(
    db: Session, client_user: User, freelancer_user: User, admin_user: User
) -> None:
    # a user with no role on the contract cannot escalate it
    contract = make_active_contract(db, client_user, freelancer_user)

    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    with pytest.raises(DisputeParticipationError):
        create_dispute(db, admin_user.id, data)


def test_create_dispute_requires_existing_contract(db: Session, client_user: User) -> None:
    # unknown contracts fail before any participation check can run
    data = CREATE_PAYLOAD.model_copy(update={"contract_id": 999999})
    with pytest.raises(ContractNotFoundError):
        create_dispute(db, client_user.id, data)


def test_get_dispute_returns_none_for_unknown_id(db: Session) -> None:
    # the router turns the missing row into a 404 at the boundary
    assert get_dispute(db, 999999) is None


def test_list_open_disputes_returns_queue_without_resolved_items(
    db: Session, client_user: User, freelancer_user: User, admin_user: User
) -> None:
    # the admin queue keeps every dispute awaiting action and drops resolved ones
    contract_a = make_active_contract(db, client_user, freelancer_user)
    contract_b = make_active_contract(
        db, client_user, freelancer_user
    )  # helper creates distinct projects each call

    data_a = CREATE_PAYLOAD.model_copy(update={"contract_id": contract_a.id})
    data_b = CREATE_PAYLOAD.model_copy(update={"contract_id": contract_b.id})
    dispute_a = create_dispute(db, client_user.id, data_a)
    dispute_b = create_dispute(db, freelancer_user.id, data_b)

    # an under-review dispute stays in the queue until it is resolved
    start_review(db, dispute_a.id, admin_user.id)

    queue = list_open_disputes(db)
    assert {dispute.id for dispute in queue} == {dispute_a.id, dispute_b.id}

    # once resolved, the dispute leaves the queue permanently
    resolve_dispute(db, dispute_a.id, admin_user.id, RESOLVE_PAYLOAD)
    queue_after = list_open_disputes(db)
    assert [dispute.id for dispute in queue_after] == [dispute_b.id]


def test_start_review_moves_open_dispute_to_under_review(
    db: Session, client_user: User, freelancer_user: User, admin_user: User
) -> None:
    # an admin picks a dispute up from the queue
    contract = make_active_contract(db, client_user, freelancer_user)
    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    dispute = create_dispute(db, client_user.id, data)

    updated = start_review(db, dispute.id, admin_user.id)

    assert updated.status == DisputeStatus.UNDER_REVIEW
    assert updated.resolution is None
    assert updated.resolved_by is None


def test_start_review_requires_an_admin(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # participants may open disputes but never drive the admin workflow
    contract = make_active_contract(db, client_user, freelancer_user)
    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    dispute = create_dispute(db, client_user.id, data)

    with pytest.raises(AdminPermissionError):
        start_review(db, dispute.id, client_user.id)


def test_start_review_only_works_on_open_disputes(
    db: Session, client_user: User, freelancer_user: User, admin_user: User
) -> None:
    # the OPEN -> UNDER_REVIEW transition happens exactly once
    contract = make_active_contract(db, client_user, freelancer_user)
    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    dispute = create_dispute(db, client_user.id, data)

    start_review(db, dispute.id, admin_user.id)
    with pytest.raises(DisputeNotOpenError):
        start_review(db, dispute.id, admin_user.id)


def test_start_review_requires_existing_dispute(db: Session, admin_user: User) -> None:
    # unknown disputes fail the lookup before any state transition
    with pytest.raises(DisputeNotFoundError):
        start_review(db, 999999, admin_user.id)


def test_resolve_dispute_completes_the_admin_workflow(
    db: Session, client_user: User, freelancer_user: User, admin_user: User
) -> None:
    # OPEN -> UNDER_REVIEW -> RESOLVED with decision and accountability stored
    contract = make_active_contract(db, client_user, freelancer_user)
    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    dispute = create_dispute(db, client_user.id, data)
    start_review(db, dispute.id, admin_user.id)

    resolved = resolve_dispute(db, dispute.id, admin_user.id, RESOLVE_PAYLOAD)

    assert resolved.status == DisputeStatus.RESOLVED
    assert resolved.resolution == "Partial refund issued to the client."
    assert resolved.resolved_by == admin_user.id


def test_resolve_dispute_requires_an_admin(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # neither contract party can close a dispute themselves
    contract = make_active_contract(db, client_user, freelancer_user)
    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    dispute = create_dispute(db, client_user.id, data)

    with pytest.raises(AdminPermissionError):
        resolve_dispute(db, dispute.id, freelancer_user.id, RESOLVE_PAYLOAD)


def test_resolve_dispute_requires_under_review_status(
    db: Session, client_user: User, freelancer_user: User, admin_user: User
) -> None:
    # resolving a freshly opened dispute skips the review step and is rejected
    contract = make_active_contract(db, client_user, freelancer_user)
    data = CREATE_PAYLOAD.model_copy(update={"contract_id": contract.id})
    dispute = create_dispute(db, client_user.id, data)

    with pytest.raises(DisputeNotUnderReviewError):
        resolve_dispute(db, dispute.id, admin_user.id, RESOLVE_PAYLOAD)

    # and a resolved dispute is final; it cannot be resolved twice
    start_review(db, dispute.id, admin_user.id)
    resolve_dispute(db, dispute.id, admin_user.id, RESOLVE_PAYLOAD)
    with pytest.raises(DisputeNotUnderReviewError):
        resolve_dispute(db, dispute.id, admin_user.id, RESOLVE_PAYLOAD)


def test_resolve_dispute_requires_existing_dispute(db: Session, admin_user: User) -> None:
    # unknown disputes fail the lookup before any state transition
    with pytest.raises(DisputeNotFoundError):
        resolve_dispute(db, 999999, admin_user.id, RESOLVE_PAYLOAD)
