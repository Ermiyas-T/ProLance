from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models.project import ProjectStatus
from app.schemas.project import ProjectCreate, ProjectFilters, ProjectSortBy, ProjectUpdate


def test_project_create_normalizes_safe_inputs() -> None:
    # verify caller convenience normalization happens before persistence
    data = ProjectCreate(
        title="  Backend API  ",
        description="  Build endpoints  ",
        budget=Decimal("500.00"),
        currency="usd",
        deadline=datetime.now(timezone.utc) + timedelta(days=7),
        skill_ids=[1, 2],
    )

    assert data.title == "Backend API"
    assert data.description == "Build endpoints"
    assert data.currency == "USD"


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "   "},
        {"description": "   "},
        {"budget": Decimal("0.00")},
        {"currency": "US1"},
        {"deadline": datetime.now(timezone.utc) - timedelta(days=1)},
        {"skill_ids": [1, 1]},
    ],
)
def test_project_create_rejects_invalid_inputs(payload: dict[str, object]) -> None:
    # protect project integrity before invalid values reach the database
    valid_payload = {
        "title": "Backend API",
        "description": "Build endpoints",
        "budget": Decimal("500.00"),
        "currency": "USD",
        "deadline": datetime.now(timezone.utc) + timedelta(days=7),
        "skill_ids": [1, 2],
    }

    with pytest.raises(ValidationError):
        ProjectCreate(**(valid_payload | payload))


def test_project_update_preserves_partial_patch_semantics() -> None:
    # allow clients to update one draft field without resending the whole project
    data = ProjectUpdate(title="  Updated title  ")

    assert data.title == "Updated title"
    assert data.description is None


def test_project_filters_reject_inverted_budget_range() -> None:
    # avoid confusing marketplace queries where the minimum exceeds the maximum
    with pytest.raises(ValidationError):
        ProjectFilters(
            min_budget=Decimal("1000.00"),
            max_budget=Decimal("500.00"),
            status=ProjectStatus.OPEN,
            sort_by=ProjectSortBy.CREATED_AT,
        )
