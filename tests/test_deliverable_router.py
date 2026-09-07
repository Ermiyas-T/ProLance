from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.contract import ContractStatus
from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.user import User
from helpers import make_contract, make_project, make_proposal


def test_deliverable_submit_list_and_get_flow(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # the freelancer submits, both participants can read the trail
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)

    submit_response = client.post(
        f"/contracts/{contract.id}/deliverables",
        json={"message": "First version", "file_url": "https://files.example.com/v1.zip"},
        headers=freelancer_headers,
    )
    assert submit_response.status_code == 201
    body = submit_response.json()
    assert body["version_number"] == 1
    assert body["status"] == "SUBMITTED"
    assert body["file_url"] == "https://files.example.com/v1.zip"

    # the submission cascaded the contract into DELIVERED
    contract_response = client.get(f"/contracts/{contract.id}", headers=client_headers)
    assert contract_response.json()["status"] == "DELIVERED"

    # both participants can list the trail
    client_list = client.get(f"/contracts/{contract.id}/deliverables", headers=client_headers)
    freelancer_list = client.get(
        f"/contracts/{contract.id}/deliverables", headers=freelancer_headers
    )
    assert client_list.status_code == 200
    assert len(client_list.json()) == 1
    assert freelancer_list.status_code == 200

    # both participants can fetch one deliverable by id
    detail = client.get(f"/deliverables/{body['id']}", headers=freelancer_headers)
    assert detail.status_code == 200
    assert detail.json()["contract_id"] == contract.id


def test_deliverable_endpoints_reject_outsiders_and_non_freelancers(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    admin_headers: dict[str, str],
    freelancer_headers: dict[str, str],
    client_headers: dict[str, str],
) -> None:
    # seed a contract where the requester roles can be exercised against the guards
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)

    # unauthenticated requests are rejected
    assert client.post(f"/contracts/{contract.id}/deliverables", json={"message": "anon"}).status_code == 401

    # non-participants cannot submit or list
    assert client.post(
        f"/contracts/{contract.id}/deliverables", json={"message": "outsider"}, headers=admin_headers
    ).status_code == 403
    assert client.get(f"/contracts/{contract.id}/deliverables", headers=admin_headers).status_code == 403

    # the client cannot submit work on their own contract
    assert client.post(
        f"/contracts/{contract.id}/deliverables", json={"message": "client"}, headers=client_headers
    ).status_code == 403

    # unknown contracts return 404
    assert client.post(
        "/contracts/999999/deliverables", json={"message": "ghost"}, headers=freelancer_headers
    ).status_code == 404


def test_deliverable_approve_completes_contract_and_project(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # submit then approve and verify the full completion cascade over HTTP
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)
    submit_response = client.post(
        f"/contracts/{contract.id}/deliverables",
        json={"message": "Final work"},
        headers=freelancer_headers,
    )
    deliverable_id = submit_response.json()["id"]

    # the freelancer cannot approve their own work
    freelancer_approve = client.post(
        f"/deliverables/{deliverable_id}/approve", json={}, headers=freelancer_headers
    )
    assert freelancer_approve.status_code == 403

    approve_response = client.post(
        f"/deliverables/{deliverable_id}/approve", json={}, headers=client_headers
    )
    db.refresh(contract)
    db.refresh(project)

    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "APPROVED"
    assert contract.status == ContractStatus.COMPLETED
    assert project.status == ProjectStatus.COMPLETED

    # approving twice hits the state guard
    replay = client.post(f"/deliverables/{deliverable_id}/approve", json={}, headers=client_headers)
    assert replay.status_code == 409


def test_deliverable_request_revision_reopens_contract_and_versioning(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # a full revision cycle over HTTP: submit, revise, resubmit as version 2
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)
    first = client.post(
        f"/contracts/{contract.id}/deliverables",
        json={"message": "v1"},
        headers=freelancer_headers,
    )
    first_id = first.json()["id"]

    # revision notes are required by the schema
    missing_notes = client.post(
        f"/deliverables/{first_id}/request-revision", json={}, headers=client_headers
    )
    assert missing_notes.status_code == 422

    revision_response = client.post(
        f"/deliverables/{first_id}/request-revision",
        json={"revision_notes": "Please add error handling"},
        headers=client_headers,
    )
    db.refresh(contract)
    assert revision_response.status_code == 200
    assert revision_response.json()["status"] == "REVISION_REQUESTED"
    assert revision_response.json()["revision_notes"] == "Please add error handling"
    assert contract.status == ContractStatus.ACTIVE

    # the freelancer resubmits; the trail appends version 2 immutably
    second = client.post(
        f"/contracts/{contract.id}/deliverables",
        json={"message": "v2"},
        headers=freelancer_headers,
    )
    trail = client.get(f"/contracts/{contract.id}/deliverables", headers=client_headers)

    assert second.status_code == 201
    assert second.json()["version_number"] == 2
    assert [item["version_number"] for item in trail.json()] == [1, 2]

    # only SUBMITTED deliverables can be revised
    replay = client.post(
        f"/deliverables/{first_id}/request-revision",
        json={"revision_notes": "again"},
        headers=client_headers,
    )
    assert replay.status_code == 409


def test_deliverable_submission_blocked_on_completed_contract(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    freelancer_headers: dict[str, str],
) -> None:
    # contracts that left the active lifecycle no longer accept submissions
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal, status=ContractStatus.COMPLETED)

    blocked = client.post(
        f"/contracts/{contract.id}/deliverables",
        json={"message": "too late"},
        headers=freelancer_headers,
    )
    assert blocked.status_code == 409
