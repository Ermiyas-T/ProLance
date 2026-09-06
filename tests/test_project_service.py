from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models.project import ProjectStatus
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectFilters, ProjectSortBy, ProjectUpdate
from app.services.project_service import (
    InvalidProjectSkillError,
    InvalidProjectStateError,
    ProjectOwnershipError,
    cancel_project,
    create_project,
    list_projects,
    publish_project,
    update_project,
)
from helpers import future_deadline, make_project


def test_create_project_starts_as_owned_draft(
    db: Session,
    client_user: User,
    python_skill,
) -> None:
    # create projects through the service so lifecycle status stays server-controlled
    project = create_project(
        db,
        client_user.id,
        ProjectCreate(
            title="  API build  ",
            description="Build a FastAPI service",
            budget=Decimal("1000.00"),
            currency="usd",
            deadline=future_deadline(),
            skill_ids=[python_skill.id],
        ),
    )

    assert project.owner_id == client_user.id
    assert project.status == ProjectStatus.DRAFT
    assert [skill.name for skill in project.skills] == ["Python"]


def test_create_project_rejects_unknown_skill(db: Session, client_user: User) -> None:
    # fail fast when the client references reusable skills that do not exist
    with pytest.raises(InvalidProjectSkillError):
        create_project(
            db,
            client_user.id,
            ProjectCreate(
                title="API build",
                description="Build a FastAPI service",
                budget=Decimal("1000.00"),
                deadline=future_deadline(),
                skill_ids=[999],
            ),
        )


def test_update_project_requires_owner_and_draft_status(
    db: Session,
    client_user: User,
    other_client_user: User,
) -> None:
    # only the owner can modify unpublished requirements
    draft = make_project(db, client_user.id, ProjectStatus.DRAFT)

    with pytest.raises(ProjectOwnershipError):
        update_project(db, draft.id, other_client_user.id, ProjectUpdate(title="No access"))

    # once public, edits must go through explicit lifecycle actions instead
    publish_project(db, draft.id, client_user.id)
    with pytest.raises(InvalidProjectStateError):
        update_project(db, draft.id, client_user.id, ProjectUpdate(title="Too late"))


def test_publish_and_cancel_project_enforce_legal_transitions(
    db: Session,
    client_user: User,
) -> None:
    # publish is allowed exactly from draft to open
    draft = make_project(db, client_user.id, ProjectStatus.DRAFT)
    published = publish_project(db, draft.id, client_user.id)

    assert published.status == ProjectStatus.OPEN

    # publishing an already open project would skip the service state machine
    with pytest.raises(InvalidProjectStateError):
        publish_project(db, draft.id, client_user.id)

    # cancellation is allowed before in-progress work exists
    cancelled = cancel_project(db, draft.id, client_user.id)
    assert cancelled.status == ProjectStatus.CANCELLED


def test_list_projects_filters_and_paginates_open_marketplace(
    db: Session,
    client_user: User,
) -> None:
    # seed projects across statuses and budgets to verify public discovery rules
    make_project(db, client_user.id, ProjectStatus.OPEN, title="Small API", budget=Decimal("500.00"))
    make_project(db, client_user.id, ProjectStatus.OPEN, title="Large API", budget=Decimal("1500.00"))
    make_project(db, client_user.id, ProjectStatus.DRAFT, title="Hidden API", budget=Decimal("2000.00"))

    projects, total = list_projects(
        db,
        ProjectFilters(
            min_budget=Decimal("1000.00"),
            status=ProjectStatus.OPEN,
            search="api",
            sort_by=ProjectSortBy.BUDGET,
        ),
        page=1,
        page_size=10,
    )

    assert total == 1
    assert [project.title for project in projects] == ["Large API"]
