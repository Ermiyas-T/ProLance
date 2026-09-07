from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models.contract import ContractStatus
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.project import ProjectStatus
from app.models.user import User
from app.schemas.deliverable import DeliverableRevisionRequest, DeliverableSubmit
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
from helpers import make_contract, make_project, make_proposal


# seed an accepted contract so deliverable actions have a realistic starting point
def make_active_contract(db: Session, client_user: User, freelancer_user: User):
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, price=Decimal("700.00"))
    return make_contract(db, project, proposal), project


def test_submit_deliverable_creates_version_one_and_delivers_contract(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # the first submission starts the version trail at 1 and marks the contract DELIVERED
    contract, _project = make_active_contract(db, client_user, freelancer_user)

    deliverable = submit_deliverable(
        db, contract.id, freelancer_user.id, DeliverableSubmit(message="First delivery")
    )

    db.refresh(contract)
    assert deliverable.version_number == 1
    assert deliverable.status == DeliverableStatus.SUBMITTED
    assert deliverable.message == "First delivery"
    assert deliverable.file_url is None
    assert contract.status == ContractStatus.DELIVERED


def test_submit_deliverable_auto_increments_versions_after_revision_cycle(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # a full revision cycle must append version 2 instead of overwriting version 1
    contract, _project = make_active_contract(db, client_user, freelancer_user)

    first = submit_deliverable(
        db, contract.id, freelancer_user.id, DeliverableSubmit(message="v1")
    )
    request_revision(
        db, first.id, client_user.id, DeliverableRevisionRequest(revision_notes="Add tests")
    )
    second = submit_deliverable(
        db, contract.id, freelancer_user.id, DeliverableSubmit(message="v2")
    )

    trail = list_deliverables(db, contract.id, client_user.id)
    assert [item.version_number for item in trail] == [1, 2]
    assert [item.id for item in trail] == [first.id, second.id]
    assert trail[0].status == DeliverableStatus.REVISION_REQUESTED
    assert trail[0].revision_notes == "Add tests"
    assert second.status == DeliverableStatus.SUBMITTED


def test_submit_deliverable_rejects_non_freelancer_and_inactive_contract(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # the client is a participant but not the freelancer, so submission is forbidden
    contract, _project = make_active_contract(db, client_user, freelancer_user)
    with pytest.raises(NotContractFreelancerError):
        submit_deliverable(
            db, contract.id, client_user.id, DeliverableSubmit(message="not mine")
        )

    # completed contracts no longer accept submissions
    contract.status = ContractStatus.COMPLETED
    db.commit()
    with pytest.raises(ContractNotActiveError):
        submit_deliverable(
            db, contract.id, freelancer_user.id, DeliverableSubmit(message="too late")
        )

    # delivered contracts require a revision request to reopen before resubmitting
    contract.status = ContractStatus.DELIVERED
    db.commit()
    with pytest.raises(ContractNotActiveError):
        submit_deliverable(
            db, contract.id, freelancer_user.id, DeliverableSubmit(message="double submit")
        )

    # non-participants are rejected before any role or state checks
    with pytest.raises(DeliverableParticipationError):
        submit_deliverable(
            db, contract.id, 999999, DeliverableSubmit(message="intruder")
        )


def test_submit_deliverable_missing_contract_raises_not_found(
    db: Session, freelancer_user: User
) -> None:
    # unknown contracts surface as missing resources, not permission errors
    with pytest.raises(DeliverableNotFoundError):
        submit_deliverable(
            db, 999999, freelancer_user.id, DeliverableSubmit(message="ghost")
        )


def test_approve_deliverable_cascades_contract_and_project_to_completed(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # approval completes the deliverable, contract, and project in one cascade
    contract, project = make_active_contract(db, client_user, freelancer_user)
    deliverable = submit_deliverable(
        db, contract.id, freelancer_user.id, DeliverableSubmit(message="Done")
    )

    approved = approve_deliverable(db, deliverable.id, client_user.id)
    db.refresh(contract)
    db.refresh(project)

    assert approved.status == DeliverableStatus.APPROVED
    assert contract.status == ContractStatus.COMPLETED
    assert project.status == ProjectStatus.COMPLETED


def test_request_revision_reopens_contract_and_stores_notes(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # a revision request reopens the contract so the freelancer can resubmit
    contract, _project = make_active_contract(db, client_user, freelancer_user)
    deliverable = submit_deliverable(
        db, contract.id, freelancer_user.id, DeliverableSubmit(message="Draft")
    )

    revised = request_revision(
        db, deliverable.id, client_user.id, DeliverableRevisionRequest(revision_notes="Please rework X")
    )
    db.refresh(contract)

    assert revised.status == DeliverableStatus.REVISION_REQUESTED
    assert revised.revision_notes == "Please rework X"
    assert contract.status == ContractStatus.ACTIVE


def test_review_actions_require_client_role_and_submitted_state(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # the freelancer cannot approve or request revision on their own work
    contract, _project = make_active_contract(db, client_user, freelancer_user)
    deliverable = submit_deliverable(
        db, contract.id, freelancer_user.id, DeliverableSubmit(message="Work")
    )

    with pytest.raises(NotContractClientError):
        approve_deliverable(db, deliverable.id, freelancer_user.id)
    with pytest.raises(NotContractClientError):
        request_revision(
            db, deliverable.id, freelancer_user.id, DeliverableRevisionRequest(revision_notes="self")
        )

    # unrelated users cannot review either
    with pytest.raises(DeliverableParticipationError):
        approve_deliverable(db, deliverable.id, 999999)

    # only SUBMITTED deliverables can be reviewed; replay both transitions
    deliverable.status = DeliverableStatus.APPROVED
    db.commit()
    with pytest.raises(InvalidDeliverableStateError):
        approve_deliverable(db, deliverable.id, client_user.id)
    with pytest.raises(InvalidDeliverableStateError):
        request_revision(
            db, deliverable.id, client_user.id, DeliverableRevisionRequest(revision_notes="again")
        )


def test_list_deliverables_requires_participation_and_orders_by_version(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # participants see the ordered trail; outsiders get a participation error
    contract, _project = make_active_contract(db, client_user, freelancer_user)
    first = submit_deliverable(db, contract.id, freelancer_user.id, DeliverableSubmit(message="v1"))
    # the contract must be reopened before the next legal submission
    request_revision(
        db, first.id, client_user.id, DeliverableRevisionRequest(revision_notes="rework")
    )
    submit_deliverable(db, contract.id, freelancer_user.id, DeliverableSubmit(message="v2"))

    trail = list_deliverables(db, contract.id, client_user.id)
    assert [item.version_number for item in trail] == [1, 2]

    with pytest.raises(DeliverableParticipationError):
        list_deliverables(db, contract.id, 999999)


def test_get_deliverable_returns_none_for_missing_rows(db: Session) -> None:
    # keep the lookup helper honest for the router's 404 path
    assert get_deliverable(db, 999999) is None
