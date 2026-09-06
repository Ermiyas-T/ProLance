from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.project import ProjectStatus
from app.models.user import User
from helpers import future_deadline, make_project


def project_payload(skill_ids: list[int] | None = None) -> dict[str, object]:
    # build a valid project API payload that tests can override precisely
    return {
        "title": "Marketplace API",
        "description": "Build an API for a freelancer marketplace.",
        "budget": "1200.00",
        "currency": "usd",
        "deadline": future_deadline().isoformat(),
        "skill_ids": skill_ids or [],
    }


def test_client_can_create_publish_and_view_open_project(
    client: TestClient,
    client_headers: dict[str, str],
    python_skill,
) -> None:
    # create starts as a private draft owned by the authenticated client
    create_response = client.post(
        "/projects",
        json=project_payload([python_skill.id]),
        headers=client_headers,
    )
    project_id = create_response.json()["id"]

    # publish exposes the project to the public marketplace
    publish_response = client.post(f"/projects/{project_id}/publish", headers=client_headers)
    get_response = client.get(f"/projects/{project_id}")

    assert create_response.status_code == 201
    assert create_response.json()["status"] == "DRAFT"
    assert publish_response.status_code == 200
    assert publish_response.json()["status"] == "OPEN"
    assert get_response.status_code == 200
    assert get_response.json()["skills"][0]["name"] == "Python"


def test_project_router_enforces_role_owner_and_public_visibility(
    client: TestClient,
    db: Session,
    client_user: User,
    client_headers: dict[str, str],
    other_client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
) -> None:
    # freelancer accounts cannot create client-owned projects
    role_response = client.post("/projects", json=project_payload(), headers=freelancer_headers)

    # drafts are private and cannot be read through the public detail endpoint
    draft = make_project(db, client_user.id, ProjectStatus.DRAFT)
    visibility_response = client.get(f"/projects/{draft.id}")

    # another client cannot mutate someone else's draft
    owner_response = client.put(
        f"/projects/{draft.id}",
        json={"title": "Hijacked"},
        headers=other_client_headers,
    )

    assert role_response.status_code == 403
    assert visibility_response.status_code == 404
    assert owner_response.status_code == 403


def test_project_list_allows_only_open_marketplace_filters(
    client: TestClient,
    db: Session,
    client_user: User,
) -> None:
    # seed open and draft projects to verify public list filtering
    make_project(db, client_user.id, ProjectStatus.OPEN, title="Small API", budget=Decimal("500.00"))
    make_project(db, client_user.id, ProjectStatus.OPEN, title="Large API", budget=Decimal("1500.00"))
    make_project(db, client_user.id, ProjectStatus.DRAFT, title="Hidden API", budget=Decimal("2000.00"))

    list_response = client.get("/projects?min_budget=1000&search=api&sort_by=budget")
    draft_filter_response = client.get("/projects?status=DRAFT")

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["items"][0]["title"] == "Large API"
    assert draft_filter_response.status_code == 403
