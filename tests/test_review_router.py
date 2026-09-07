from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.contract import ContractStatus
from app.models.profile import FreelancerProfile
from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.user import User
from helpers import make_contract, make_project, make_proposal


# seed a completed contract so review requests have a legal starting point
def make_completed_contract(db: Session, client_user: User, freelancer_user: User):
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)
    contract.status = ContractStatus.COMPLETED
    db.commit()
    return contract


def test_review_router_create_and_public_listing_flow(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # the client reviews the freelancer on a completed contract
    contract = make_completed_contract(db, client_user, freelancer_user)
    db.add(
        FreelancerProfile(
            user_id=freelancer_user.id,
            hourly_rate=Decimal("50.00"),
        )
    )
    db.commit()

    response = client.post(
        "/reviews",
        json={"contract_id": contract.id, "rating_overall": 5, "comment": "Outstanding work"},
        headers=client_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["review_type"] == "CLIENT_TO_FREELANCER"
    assert body["reviewer_id"] == client_user.id
    assert body["reviewee_id"] == freelancer_user.id
    assert body["rating_overall"] == 5

    # the public reputation endpoint exposes the received review without authentication
    public_list = client.get(f"/users/{freelancer_user.id}/reviews")
    assert public_list.status_code == 200
    assert [item["comment"] for item in public_list.json()] == ["Outstanding work"]

    # the average-rating helper endpoint reports the fresh aggregate
    average = client.get(f"/users/{freelancer_user.id}/reviews/average")
    assert average.status_code == 200
    assert average.json()["average_rating"] == 5.0


def test_review_router_rejects_outsiders_duplicates_and_early_reviews(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    admin_headers: dict[str, str],
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # seed one completed contract to exercise each guard against
    contract = make_completed_contract(db, client_user, freelancer_user)

    # unauthenticated requests are rejected
    anon = client.post(
        "/reviews",
        json={"contract_id": contract.id, "rating_overall": 5, "comment": "anon"},
    )
    assert anon.status_code == 401

    # non-participants are forbidden even when authenticated
    outsider = client.post(
        "/reviews",
        json={"contract_id": contract.id, "rating_overall": 5, "comment": "outsider"},
        headers=admin_headers,
    )
    assert outsider.status_code == 403

    # out-of-range ratings fail request validation before any business logic
    invalid = client.post(
        "/reviews",
        json={"contract_id": contract.id, "rating_overall": 9, "comment": "too high"},
        headers=client_headers,
    )
    assert invalid.status_code == 422

    # the first review succeeds, the second hits the friendly duplicate conflict
    first = client.post(
        "/reviews",
        json={"contract_id": contract.id, "rating_overall": 5, "comment": "First"},
        headers=client_headers,
    )
    duplicate = client.post(
        "/reviews",
        json={"contract_id": contract.id, "rating_overall": 1, "comment": "Second"},
        headers=client_headers,
    )
    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "You have already reviewed this contract"

    # unknown contracts return 404
    ghost = client.post(
        "/reviews",
        json={"contract_id": 999999, "rating_overall": 5, "comment": "ghost"},
        headers=freelancer_headers,
    )
    assert ghost.status_code == 404

    # active contracts cannot be reviewed yet
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS, title="Active job")
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    active_contract = make_contract(db, project, proposal)
    early = client.post(
        "/reviews",
        json={"contract_id": active_contract.id, "rating_overall": 5, "comment": "early"},
        headers=client_headers,
    )
    assert early.status_code == 409


def test_review_router_accepts_reviews_from_both_parties(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # bilateral evaluation: each participant reviews the other exactly once
    contract = make_completed_contract(db, client_user, freelancer_user)

    client_review = client.post(
        "/reviews",
        json={"contract_id": contract.id, "rating_overall": 5, "comment": "Great freelancer"},
        headers=client_headers,
    )
    freelancer_review = client.post(
        "/reviews",
        json={
            "contract_id": contract.id,
            "rating_overall": 4,
            "rating_communication": 5,
            "comment": "Great client",
        },
        headers=freelancer_headers,
    )

    assert client_review.status_code == 201
    assert client_review.json()["review_type"] == "CLIENT_TO_FREELANCER"
    assert freelancer_review.status_code == 201
    assert freelancer_review.json()["review_type"] == "FREELANCER_TO_CLIENT"
    assert freelancer_review.json()["rating_communication"] == 5

    # both reviews appear in each party's public trail
    client_trail = client.get(f"/users/{client_user.id}/reviews")
    freelancer_trail = client.get(f"/users/{freelancer_user.id}/reviews")
    assert len(client_trail.json()) == 1
    assert len(freelancer_trail.json()) == 1


def test_review_router_validates_sub_rating_ranges(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
) -> None:
    # sub-ratings share the same 1..5 bound as the headline score
    contract = make_completed_contract(db, client_user, freelancer_user)

    invalid_sub = client.post(
        "/reviews",
        json={
            "contract_id": contract.id,
            "rating_overall": 4,
            "rating_quality": 0,
            "comment": "bad sub-score",
        },
        headers=client_headers,
    )
    assert invalid_sub.status_code == 422

    missing_comment = client.post(
        "/reviews",
        json={"contract_id": contract.id, "rating_overall": 4},
        headers=client_headers,
    )
    assert missing_comment.status_code == 422
