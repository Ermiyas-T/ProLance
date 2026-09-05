from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.proposal import ProposalStatus


# validate user-written proposal text so blank strings are never persisted
def _normalize_required_text(value: str, field_name: str) -> str:
    normalized_value = value.strip()
    if not normalized_value:
        raise ValueError(f"{field_name} must not be blank")
    return normalized_value


# validate proposal creation while keeping lifecycle fields server-controlled
class ProposalCreate(BaseModel):
    project_id: int = Field(gt=0)
    proposed_price: Decimal = Field(gt=Decimal("0.00"), max_digits=10, decimal_places=2)
    delivery_days: int = Field(gt=0)
    cover_letter: str = Field(min_length=1)

    # remove accidental surrounding whitespace from required cover letter text
    @field_validator("cover_letter")
    @classmethod
    def normalize_cover_letter(cls, value: str) -> str:
        return _normalize_required_text(value, "Cover letter")


# describe an individual proposal returned from a persisted SQLAlchemy row
class ProposalOut(BaseModel):
    # allow FastAPI to serialize SQLAlchemy models
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    freelancer_id: int
    proposed_price: Decimal
    delivery_days: int
    cover_letter: str
    status: ProposalStatus
    created_at: datetime
    updated_at: datetime


# return a predictable envelope for growing proposal result sets
class ProposalListOut(BaseModel):
    items: list[ProposalOut]
    total: int
    page: int
    page_size: int
