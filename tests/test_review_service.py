from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contract import ContractStatus
from app.models.profile import FreelancerProfile
from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.review import Review, ReviewType
from app.models.user import User
from app.schemas.review import ReviewCreate
from app.services.review_service import (
    ContractNotCompletedError,
    DuplicateReviewError,
    ReviewNotFoundError,
    ReviewParticipationError,
    calculate_average_rating,
    create_review,
    get_reviews_for_user,
)
from helpers import make_contract, make_project, make_proposal


# seed a completed contract plus its participant users for review tests
def make_completed_contract(db: Session, client_user: User, freelancer_user: User):
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)
    contract.status = ContractStatus.COMPLETED
    db.commit()
    return contract


# seed a freelancer profile so aggregate metric updates have a row to write to
def make_freelancer_profile(db: Session, freelancer_user: User) -> FreelancerProfile:
    profile = FreelancerProfile(
        user_id=freelancer_user.id,
        hourly_rate=Decimal("45.00"),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def test_client_review_routes_to_freelancer_and_updates_metrics(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # a client review must derive routing from the contract and refresh aggregates
    contract = make_completed_contract(db, client_user, freelancer_user)
    profile = make_freelancer_profile(db, freelancer_user)

    review = create_review(
        db,
        client_user.id,
        ReviewCreate(contract_id=contract.id, rating_overall=5, comment="Great work"),
    )

    assert review.review_type == ReviewType.CLIENT_TO_FREELANCER
    assert review.reviewer_id == client_user.id
    assert review.reviewee_id == freelancer_user.id
    assert review.rating_overall == 5

    # one five-star work review lifts the average and completes one project
    db.refresh(profile)
    assert profile.avg_rating == Decimal("5.00")
    assert profile.completed_projects_count == 1


def test_freelancer_review_routes_to_client_without_touching_work_metrics(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # freelancer-to-client reviews must not count toward work reputation aggregates
    contract = make_completed_contract(db, client_user, freelancer_user)
    profile = make_freelancer_profile(db, freelancer_user)

    review = create_review(
        db,
        freelancer_user.id,
        ReviewCreate(contract_id=contract.id, rating_overall=4, comment="Clear requirements"),
    )

    assert review.review_type == ReviewType.FREELANCER_TO_CLIENT
    assert review.reviewee_id == client_user.id

    # the freelancer's own metrics stay untouched by their outbound review
    db.refresh(profile)
    assert profile.avg_rating == Decimal("0.00")
    assert profile.completed_projects_count == 0


def test_average_rating_recomputes_correctly_across_multiple_reviews(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # mixed scores must produce the exact fixed-precision mean, not a running guess
    first_contract = make_completed_contract(db, client_user, freelancer_user)
    profile = make_freelancer_profile(db, freelancer_user)

    create_review(
        db,
        client_user.id,
        ReviewCreate(contract_id=first_contract.id, rating_overall=4, comment="Good"),
    )

    # a second completed contract lets the same client review again (different contract)
    second_contract = make_completed_contract(db, client_user, freelancer_user)
    create_review(
        db,
        client_user.id,
        ReviewCreate(contract_id=second_contract.id, rating_overall=2, comment="Mixed"),
    )

    db.refresh(profile)
    assert profile.avg_rating == Decimal("3.00")
    assert profile.completed_projects_count == 2

    # the standalone helper mirrors the aggregate for the reviewee
    assert calculate_average_rating(db, freelancer_user.id) == Decimal("3.00")


def test_duplicate_review_rejected_at_service_and_database_levels(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # the pre-check raises the friendly error before touching the database constraint
    contract = make_completed_contract(db, client_user, freelancer_user)
    make_freelancer_profile(db, freelancer_user)

    create_review(
        db,
        client_user.id,
        ReviewCreate(contract_id=contract.id, rating_overall=5, comment="First"),
    )

    with pytest.raises(DuplicateReviewError):
        create_review(
            db,
            client_user.id,
            ReviewCreate(contract_id=contract.id, rating_overall=1, comment="Second"),
        )

    # exactly one row exists and the first review's data won
    reviews = list(db.scalars(select(Review)).all())
    assert len(reviews) == 1
    assert reviews[0].comment == "First"

    # the reverse direction is still allowed: both parties can review each other
    counter_review = create_review(
        db,
        freelancer_user.id,
        ReviewCreate(contract_id=contract.id, rating_overall=4, comment="Good client"),
    )
    assert counter_review.review_type == ReviewType.FREELANCER_TO_CLIENT


def test_review_requires_completed_contract_and_participation(
    db: Session, client_user: User, freelancer_user: User, other_client_user: User
) -> None:
    # active contracts cannot be reviewed yet
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    active_contract = make_contract(db, project, proposal)

    with pytest.raises(ContractNotCompletedError):
        create_review(
            db,
            client_user.id,
            ReviewCreate(contract_id=active_contract.id, rating_overall=5, comment="Early"),
        )

    # finish the contract, then verify outsiders are rejected
    active_contract.status = ContractStatus.COMPLETED
    db.commit()
    with pytest.raises(ReviewParticipationError):
        create_review(
            db,
            other_client_user.id,
            ReviewCreate(contract_id=active_contract.id, rating_overall=5, comment="Outsider"),
        )

    # unknown contracts surface as missing resources
    with pytest.raises(ReviewNotFoundError):
        create_review(
            db,
            client_user.id,
            ReviewCreate(contract_id=999999, rating_overall=5, comment="Ghost"),
        )


def test_get_reviews_for_user_returns_received_reviews(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # the reputation trail contains reviews received, not reviews written
    contract = make_completed_contract(db, client_user, freelancer_user)

    create_review(
        db,
        client_user.id,
        ReviewCreate(contract_id=contract.id, rating_overall=5, comment="Excellent"),
    )
    create_review(
        db,
        freelancer_user.id,
        ReviewCreate(contract_id=contract.id, rating_overall=4, comment="Responsive"),
    )

    freelancer_reviews = get_reviews_for_user(db, freelancer_user.id)
    client_reviews = get_reviews_for_user(db, client_user.id)

    assert [item.comment for item in freelancer_reviews] == ["Excellent"]
    assert [item.comment for item in client_reviews] == ["Responsive"]
    assert get_reviews_for_user(db, 999999) == []


def test_metrics_recompute_is_idempotent_after_review_deletion(
    db: Session, client_user: User, freelancer_user: User
) -> None:
    # recomputing from source rows keeps aggregates correct when the data changes
    contract = make_completed_contract(db, client_user, freelancer_user)
    profile = make_freelancer_profile(db, freelancer_user)

    review = create_review(
        db,
        client_user.id,
        ReviewCreate(contract_id=contract.id, rating_overall=5, comment="Great"),
    )
    assert profile.avg_rating == Decimal("5.00")

    # simulate data loss: delete the review and recompute via a fresh client review flow
    db.delete(review)
    db.commit()
    assert calculate_average_rating(db, freelancer_user.id) is None
