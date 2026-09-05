import enum
from datetime import datetime, timezone
from decimal import Decimal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.project import ProjectStatus
from app.schemas.profile import SkillOut


# limit the exposed sorting choices to indexed and documented marketplace fields
class ProjectSortBy(str, enum.Enum):
    CREATED_AT = "created_at"
    BUDGET = "budget"
    DEADLINE = "deadline"


# validate shared user-written project text so blank strings are never persisted
def _normalize_required_text(value: str, field_name: str) -> str:
    normalized_value = value.strip()
    if not normalized_value:
        raise ValueError(f"{field_name} must not be blank")
    return normalized_value


# validate project creation while keeping lifecycle fields server-controlled
class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    budget: Decimal = Field(gt=Decimal("0.00"), max_digits=10, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    deadline: AwareDatetime
    skill_ids: list[int] = Field(default_factory=list)

    # remove accidental surrounding whitespace from required project title text
    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        return _normalize_required_text(value, "Title")

    # remove accidental surrounding whitespace from required project description text
    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str) -> str:
        return _normalize_required_text(value, "Description")

    # normalize ISO currency input and reject values outside the three-letter convention
    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized_currency = value.strip().upper()
        if len(normalized_currency) != 3 or not normalized_currency.isalpha():
            raise ValueError("Currency must be a three-letter ISO code")
        return normalized_currency

    # prevent duplicate skill links before they reach the association table
    @field_validator("skill_ids")
    @classmethod
    def validate_unique_skill_ids(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("Skill IDs must be unique")
        return value

    # ensure the advertised project deadline is a future, real-world instant
    @field_validator("deadline")
    @classmethod
    def validate_future_deadline(cls, value: datetime) -> datetime:
        if value <= datetime.now(timezone.utc):
            raise ValueError("Deadline must be in the future")
        return value


# support partial draft edits without allowing callers to assign internal status
class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    budget: Decimal | None = Field(
        default=None, gt=Decimal("0.00"), max_digits=10, decimal_places=2
    )
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    deadline: AwareDatetime | None = None
    skill_ids: list[int] | None = None

    # apply the same non-blank rule when a title is included in a patch payload
    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        return _normalize_required_text(value, "Title") if value is not None else None

    # apply the same non-blank rule when a description is included in a patch payload
    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        return _normalize_required_text(value, "Description") if value is not None else None

    # keep currency format consistent for project updates
    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        return ProjectCreate.normalize_currency(value) if value is not None else None

    # prevent duplicate skill links when replacing the required skills list
    @field_validator("skill_ids")
    @classmethod
    def validate_unique_skill_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is not None and len(value) != len(set(value)):
            raise ValueError("Skill IDs must be unique")
        return value

    # validate a replacement deadline only when the client supplied one
    @field_validator("deadline")
    @classmethod
    def validate_future_deadline(cls, value: datetime | None) -> datetime | None:
        if value is not None and value <= datetime.now(timezone.utc):
            raise ValueError("Deadline must be in the future")
        return value


# describe an individual project returned from a persisted SQLAlchemy row
class ProjectOut(BaseModel):
    # allow FastAPI to serialize SQLAlchemy models and loaded skill relationships
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    title: str
    description: str
    budget: Decimal
    currency: str
    deadline: datetime
    status: ProjectStatus
    skills: list[SkillOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# return a predictable envelope for growing marketplace result sets
class ProjectListOut(BaseModel):
    items: list[ProjectOut]
    total: int
    page: int
    page_size: int


# group list query parameters before passing them from router to service
class ProjectFilters(BaseModel):
    skill: int | None = Field(default=None)
    min_budget: Decimal | None = Field(default=None)
    max_budget: Decimal | None = Field(default=None)
    status: ProjectStatus = ProjectStatus.OPEN
    search: str | None = Field(default=None, min_length=1, max_length=200)
    sort_by: ProjectSortBy = ProjectSortBy.CREATED_AT

    # validate positive skill ID when provided
    @field_validator("skill")
    @classmethod
    def validate_skill(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("Skill ID must be positive")
        return value

    # validate positive budget values when provided
    @field_validator("min_budget", "max_budget")
    @classmethod
    def validate_budget(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= Decimal("0.00"):
            raise ValueError("Budget must be positive")
        return value

    # prevent inverted budget ranges that would silently produce confusing empty lists
    @model_validator(mode="after")
    def validate_budget_range(self) -> "ProjectFilters":
        if self.min_budget is not None and self.max_budget is not None:
            if self.min_budget > self.max_budget:
                raise ValueError("min_budget cannot be greater than max_budget")
        return self
