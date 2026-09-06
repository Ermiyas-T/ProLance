from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.user import User
from helpers import make_project, make_proposal


def proposal_payload(project_id: int) -> dict[str, object]:
    # build a valid proposal API payload that keeps status server-controlled
    return {
        "project_id": project_id,
        "proposed_price": "850.00",
        "delivery_days": 8,
        "cover_letter": "  I can build this cleanly.  ",
    }


def test_freelancer_can_create_list_view_and_withdraw_proposal(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_headers: dict[str, str],
) -> None:
    # seed an open project so a freelancer can bid on it
    project = make_project(db, client_user.id, ProjectStatus.OPEN)

    create_response = client.post(
        "/proposals",
        json=proposal_payload(project.id),
        headers=freelancer_headers,
    )
    proposal_id = create_response.json()["id"]
    list_response = client.get("/proposals", headers=freelancer_headers)
    get_response = client.get(f"/proposals/{proposal_id}", headers=freelancer_headers)
    withdraw_response = client.post(f"/proposals/{proposal_id}/withdraw", headers=freelancer_headers)

    assert create_response.status_code == 201
    assert create_response.json()["cover_letter"] == "I can build this cleanly."
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert get_response.status_code == 200
    assert withdraw_response.status_code == 200
    assert withdraw_response.json()["status"] == "WITHDRAWN"


def test_proposal_router_enforces_role_project_state_and_ownership(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    # clients cannot submit proposals because bidding is a freelancer action
    open_project = make_project(db, client_user.id, ProjectStatus.OPEN)
    role_response = client.post(
        "/proposals",
        json=proposal_payload(open_project.id),
        headers=client_headers,
    )

    # freelancers cannot bid on projects that are not open
    draft_project = make_project(db, client_user.id, ProjectStatus.DRAFT)
    state_response = client.post(
        "/proposals",
        json=proposal_payload(draft_project.id),
        headers=freelancer_headers,
    )

    # unrelated authenticated users cannot view private proposal details
    proposal = make_proposal(db, open_project.id, freelancer_user.id)
    ownership_response = client.get(f"/proposals/{proposal.id}", headers=admin_headers)

    assert role_response.status_code == 403
    assert state_response.status_code == 409
    assert ownership_response.status_code == 403


def test_project_owner_can_list_and_accept_proposal(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    other_freelancer_user: User,
    client_headers: dict[str, str],
    other_client_headers: dict[str, str],
) -> None:
    # seed competing bids so acceptance can reject the unchosen proposal
    project = make_project(db, client_user.id, ProjectStatus.OPEN)
    proposal = make_proposal(db, project.id, freelancer_user.id, price=Decimal("800.00"))
    competing = make_proposal(db, project.id, other_freelancer_user.id, price=Decimal("950.00"))

    list_response = client.get(f"/projects/{project.id}/proposals", headers=client_headers)
    forbidden_response = client.get(f"/projects/{project.id}/proposals", headers=other_client_headers)
    accept_response = client.post(f"/proposals/{proposal.id}/accept", headers=client_headers)
    db.refresh(competing)

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 2
    assert forbidden_response.status_code == 403
    assert accept_response.status_code == 200
    assert accept_response.json()["freelancer_id"] == freelancer_user.id
    assert competing.status == ProposalStatus.REJECTED
