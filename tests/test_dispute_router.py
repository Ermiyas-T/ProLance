from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.user import User
from helpers import make_contract, make_project, make_proposal


# seed a contract between the two default participants for dispute requests
def make_contract_between(db: Session, client_user: User, freelancer_user: User):
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    return make_contract(db, project, proposal)


def open_dispute(client: TestClient, contract_id: int, headers: dict[str, str]):
    # shared happy-path body so each test customizes only the actor
    return client.post(
        "/disputes",
        json={
            "contract_id": contract_id,
            "title": "Work not delivered",
            "description": "The freelancer stopped responding two weeks ago.",
        },
        headers=headers,
    )


def test_dispute_router_full_admin_lifecycle(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    admin_headers: dict[str, str],
    client_headers: dict[str, str],
) -> None:
    # a participant opens, the admin triages, reviews, and resolves the dispute
    contract = make_contract_between(db, client_user, freelancer_user)

    created = open_dispute(client, contract.id, client_headers)
    assert created.status_code == 201
    body = created.json()
    assert body["status"] == "OPEN"
    assert body["opened_by"] == client_user.id
    assert body["resolution"] is None
    assert body["resolved_by"] is None
    dispute_id = body["id"]

    # the admin queue shows the new dispute; the participant has no queue access
    queue = client.get("/disputes", headers=admin_headers)
    assert queue.status_code == 200
    assert [item["id"] for item in queue.json()] == [dispute_id]

    # start review transitions the dispute into the admin's active state
    review = client.post(f"/disputes/{dispute_id}/start-review", headers=admin_headers)
    assert review.status_code == 200
    assert review.json()["status"] == "UNDER_REVIEW"

    # the queue still holds disputes under review until they are resolved
    still_queued = client.get("/disputes", headers=admin_headers)
    assert [item["id"] for item in still_queued.json()] == [dispute_id]

    # resolution stores the decision and the admin who made it
    resolved = client.post(
        f"/disputes/{dispute_id}/resolve",
        json={"resolution": "Partial refund issued to the client."},
        headers=admin_headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "RESOLVED"
    assert resolved.json()["resolution"] == "Partial refund issued to the client."

    # resolved disputes leave the admin queue
    queue_after = client.get("/disputes", headers=admin_headers)
    assert queue_after.status_code == 200
    assert queue_after.json() == []


def test_dispute_router_guards_creation_endpoints(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    other_client_user: User,
    other_client_headers: dict[str, str],
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # creation is limited to authenticated contract participants
    contract = make_contract_between(db, client_user, freelancer_user)

    # unauthenticated requests are rejected
    anon = open_dispute(client, contract.id, {})
    assert anon.status_code == 401

    # non-participants are forbidden even when authenticated
    outsider = open_dispute(client, contract.id, other_client_headers)
    assert outsider.status_code == 403
    assert outsider.json()["detail"] == "Only contract participants can open a dispute"

    # unknown contracts return 404
    ghost = open_dispute(client, 999999, freelancer_headers)
    assert ghost.status_code == 404
    assert ghost.json()["detail"] == "Contract not found"

    # missing required fields fail request validation
    invalid = client.post(
        "/disputes", json={"contract_id": contract.id}, headers=client_headers
    )
    assert invalid.status_code == 422

    # the participant's own request succeeds
    created = open_dispute(client, contract.id, client_headers)
    assert created.status_code == 201


def test_dispute_router_admin_queue_is_role_gated(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    admin_headers: dict[str, str],
    client_headers: dict[str, str],
) -> None:
    # GET /disputes is the admin queue; regular users are explicitly forbidden
    contract = make_contract_between(db, client_user, freelancer_user)
    open_dispute(client, contract.id, client_headers)

    forbidden = client.get("/disputes", headers=client_headers)
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "Insufficient permissions"

    anonymous = client.get("/disputes")
    assert anonymous.status_code == 401

    admin_view = client.get("/disputes", headers=admin_headers)
    assert admin_view.status_code == 200
    assert len(admin_view.json()) == 1


def test_dispute_router_detail_visibility_depends_on_requester(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    other_client_user: User,
    admin_headers: dict[str, str],
    other_client_headers: dict[str, str],
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # participants and admins may read a dispute; outsiders may not
    contract = make_contract_between(db, client_user, freelancer_user)
    dispute_id = open_dispute(client, contract.id, client_headers).json()["id"]

    # both contract parties can view it
    client_view = client.get(f"/disputes/{dispute_id}", headers=client_headers)
    assert client_view.status_code == 200
    freelancer_view = client.get(f"/disputes/{dispute_id}", headers=freelancer_headers)
    assert freelancer_view.status_code == 200

    # admins can view any dispute for moderation
    admin_view = client.get(f"/disputes/{dispute_id}", headers=admin_headers)
    assert admin_view.status_code == 200

    # unrelated users are forbidden, and anonymous requests are rejected
    outsider = client.get(f"/disputes/{dispute_id}", headers=other_client_headers)
    assert outsider.status_code == 403
    anonymous = client.get(f"/disputes/{dispute_id}")
    assert anonymous.status_code == 401

    # unknown disputes return 404
    ghost = client.get("/disputes/999999", headers=admin_headers)
    assert ghost.status_code == 404


def test_dispute_router_enforces_workflow_order(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    admin_headers: dict[str, str],
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # the three-state workflow must be followed in order
    contract = make_contract_between(db, client_user, freelancer_user)
    dispute_id = open_dispute(client, contract.id, client_headers).json()["id"]

    # non-admins cannot drive the workflow even as contract participants
    forbidden_review = client.post(
        f"/disputes/{dispute_id}/start-review", headers=freelancer_headers
    )
    assert forbidden_review.status_code == 403

    # resolving before review is rejected
    premature = client.post(
        f"/disputes/{dispute_id}/resolve",
        json={"resolution": "too early"},
        headers=admin_headers,
    )
    assert premature.status_code == 409
    assert premature.json()["detail"] == "Only disputes under review can be resolved"

    # the first start-review succeeds; a second one conflicts
    first = client.post(f"/disputes/{dispute_id}/start-review", headers=admin_headers)
    assert first.status_code == 200
    second = client.post(f"/disputes/{dispute_id}/start-review", headers=admin_headers)
    assert second.status_code == 409
    assert second.json()["detail"] == "Only open disputes can enter review"

    # unknown disputes return 404 on admin mutations
    ghost_review = client.post("/disputes/999999/start-review", headers=admin_headers)
    assert ghost_review.status_code == 404
    assert ghost_review.json()["detail"] == "Dispute not found"

    # resolution requires a non-empty decision
    missing_resolution = client.post(
        f"/disputes/{dispute_id}/resolve", json={}, headers=admin_headers
    )
    assert missing_resolution.status_code == 422

    resolved = client.post(
        f"/disputes/{dispute_id}/resolve",
        json={"resolution": "Refund issued."},
        headers=admin_headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "RESOLVED"
