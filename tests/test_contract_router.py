from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.contract import ContractStatus
from app.models.project import ProjectStatus
from app.models.proposal import ProposalStatus
from app.models.user import User
from helpers import make_contract, make_project, make_proposal


def test_contract_router_lists_and_guards_participant_access(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    # seed an accepted contract visible only to its participants
    project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS)
    proposal = make_proposal(db, project.id, freelancer_user.id, ProposalStatus.ACCEPTED)
    contract = make_contract(db, project, proposal)

    client_list_response = client.get("/contracts", headers=client_headers)
    freelancer_get_response = client.get(f"/contracts/{contract.id}", headers=freelancer_headers)
    admin_get_response = client.get(f"/contracts/{contract.id}", headers=admin_headers)

    assert client_list_response.status_code == 200
    assert client_list_response.json()["total"] == 1
    assert freelancer_get_response.status_code == 200
    assert admin_get_response.status_code == 403


def test_contract_router_cancel_and_complete_update_project_state(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # cancellation mirrors the terminal cancelled status onto the project
    cancel_project = make_project(db, client_user.id, ProjectStatus.IN_PROGRESS, title="Cancel API")
    cancel_proposal = make_proposal(
        db, cancel_project.id, freelancer_user.id, ProposalStatus.ACCEPTED
    )
    cancelled_contract = make_contract(db, cancel_project, cancel_proposal)
    cancel_response = client.post(
        f"/contracts/{cancelled_contract.id}/cancel",
        headers=freelancer_headers,
    )
    db.refresh(cancel_project)

    # completion mirrors the completed status onto a separate active project
    complete_project = make_project(
        db,
        client_user.id,
        ProjectStatus.IN_PROGRESS,
        title="Complete API",
    )
    complete_proposal = make_proposal(
        db, complete_project.id, freelancer_user.id, ProposalStatus.ACCEPTED
    )
    completed_contract = make_contract(db, complete_project, complete_proposal)
    complete_response = client.post(
        f"/contracts/{completed_contract.id}/complete",
        headers=client_headers,
    )
    db.refresh(complete_project)

    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "CANCELLED"
    assert cancel_project.status == ProjectStatus.CANCELLED
    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "COMPLETED"
    assert complete_project.status == ProjectStatus.COMPLETED


def test_contract_accept_endpoint_maps_conflicts(
    client: TestClient,
    db: Session,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    other_client_headers: dict[str, str],
) -> None:
    # only the project owner can accept a pending proposal
    project = make_project(db, client_user.id, ProjectStatus.OPEN)
    proposal = make_proposal(db, project.id, freelancer_user.id)
    forbidden_response = client.post(
        f"/contracts/proposals/{proposal.id}/accept",
        headers=other_client_headers,
    )

    # accepted proposals cannot be accepted a second time
    ok_response = client.post(f"/contracts/proposals/{proposal.id}/accept", headers=client_headers)
    conflict_response = client.post(
        f"/contracts/proposals/{proposal.id}/accept",
        headers=client_headers,
    )

    assert forbidden_response.status_code == 403
    assert ok_response.status_code == 200
    assert conflict_response.status_code == 409
    assert conflict_response.json()["detail"] == "Proposal is not in a state that can be accepted"
