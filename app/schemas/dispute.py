from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.dispute import DisputeStatus


# validate request body for opening a dispute on a contract
class DisputeCreate(BaseModel):
    contract_id: int
    title: Annotated[str, Field(min_length=1, max_length=200)]
    description: Annotated[str, Field(min_length=1, max_length=5000)]


# the shape we return for a dispute in the admin queue or a participant view
class DisputeOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy Dispute row
    model_config = ConfigDict(from_attributes=True)

    id: int
    contract_id: int
    opened_by: int
    title: str
    description: str
    status: DisputeStatus
    resolution: str | None
    resolved_by: int | None
    created_at: datetime
    updated_at: datetime


# validate the admin's resolution notes when closing a dispute
class DisputeResolve(BaseModel):
    resolution: Annotated[str, Field(min_length=1, max_length=5000)]
