from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.user import User
from app.schemas.proposal import ProposalCreate
from app.services.proposal_service import (
    DuplicateProposalError,
    InvalidProjectStateError,
    InvalidProposalStateError,
    ProposalOwnershipError,
    SelfProposalError,
    create_proposal,
    get_authorized_proposal,
    list_proposals_by_freelancer,
    list_proposals_for_project,
    withdraw_proposal,
)
from helpers import make_project, make_proposal


def test_create_proposal_requires_open_project_and_distinct_freelancer(
    db: Session,
    client_user: User,
    freelancer_user: User,
) -> None:
    # reject proposals before a project is published
    draft = make_project(db, client_user.id, ProjectStatus.DRAFT)
    with pytest.raises(InvalidProjectStateError):
        create_proposal(
            db,
            freelancer_user.id,
            ProposalCreate(
                project_id=draft.id,
                proposed_price=Decimal("800.00"),
                delivery_days=7,
                cover_letter="Ready to help",
            ),
        )

    # reject proposals where the acting freelancer also owns the project
    own_project = make_project(db, freelancer_user.id, ProjectStatus.OPEN)
    with pytest.raises(SelfProposalError):
        create_proposal(
            db,
            freelancer_user.id,
            ProposalCreate(
                project_id=own_project.id,
                proposed_price=Decimal("800.00"),
                delivery_days=7,
                cover_letter="Ready to help",
            ),
        )


def test_create_proposal_persists_pending_bid_and_blocks_duplicate(
    db: Session,
    client_user: User,
    freelancer_user: User,
) -> None:
    # create a valid pending proposal for a public project
    project = make_project(db, client_user.id, ProjectStatus.OPEN)
    data = ProposalCreate(
        project_id=project.id,
        proposed_price=Decimal("800.00"),
        delivery_days=7,
        cover_letter="Ready to help",
    )
    proposal = create_proposal(db, freelancer_user.id, data)

    assert proposal.status == ProposalStatus.PENDING
    assert proposal.freelancer_id == freelancer_user.id

    # prevent the same freelancer from holding two active bids on one project
    with pytest.raises(DuplicateProposalError):
        create_proposal(db, freelancer_user.id, data)


def test_authorized_proposal_view_allows_bidder_and_project_owner_only(
    db: Session,
    client_user: User,
    other_client_user: User,
    freelancer_user: User,
) -> None:
    # seed one proposal and verify object-level read authorization
    project = make_project(db, client_user.id, ProjectStatus.OPEN)
    proposal = make_proposal(db, project.id, freelancer_user.id)

    assert get_authorized_proposal(db, proposal.id, freelancer_user.id).id == proposal.id
    assert get_authorized_proposal(db, proposal.id, client_user.id).id == proposal.id

    with pytest.raises(ProposalOwnershipError):
        get_authorized_proposal(db, proposal.id, other_client_user.id)


def test_listing_proposals_is_scoped_and_paginated(
    db: Session,
    client_user: User,
    other_client_user: User,
    freelancer_user: User,
    other_freelancer_user: User,
) -> None:
    # seed project proposals from multiple freelancers
    project = make_project(db, client_user.id, ProjectStatus.OPEN)
    make_proposal(db, project.id, freelancer_user.id, price=Decimal("800.00"))
    make_proposal(db, project.id, other_freelancer_user.id, price=Decimal("900.00"))

    project_proposals, project_total = list_proposals_for_project(
        db, project.id, client_user.id, page=1, page_size=1
    )
    freelancer_proposals, freelancer_total = list_proposals_by_freelancer(
        db, freelancer_user.id, page=1, page_size=10
    )

    assert project_total == 2
    assert len(project_proposals) == 1
    assert freelancer_total == 1
    assert freelancer_proposals[0].freelancer_id == freelancer_user.id

    # prevent unrelated clients from listing a project's private proposal inbox
    with pytest.raises(ProposalOwnershipError):
        list_proposals_for_project(db, project.id, other_client_user.id)


def test_withdraw_proposal_requires_owner_and_pending_status(
    db: Session,
    client_user: User,
    freelancer_user: User,
    other_freelancer_user: User,
) -> None:
    # only the submitting freelancer may withdraw a pending bid
    project = make_project(db, client_user.id, ProjectStatus.OPEN)
    proposal = make_proposal(db, project.id, freelancer_user.id)

    with pytest.raises(ProposalOwnershipError):
        withdraw_proposal(db, proposal.id, other_freelancer_user.id)

    withdrawn = withdraw_proposal(db, proposal.id, freelancer_user.id)
    assert withdrawn.status == ProposalStatus.WITHDRAWN

    # withdrawn proposals cannot be withdrawn again
    with pytest.raises(InvalidProposalStateError):
        withdraw_proposal(db, proposal.id, freelancer_user.id)
