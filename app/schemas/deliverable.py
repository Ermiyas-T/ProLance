import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.deliverable import DeliverableStatus


# validate request body for submitting a deliverable (V1: URL instead of file upload)
class DeliverableSubmit(BaseModel):
    # reject client-supplied id or any other unexpected fields
    model_config = ConfigDict(extra="forbid")

    message: Annotated[str, Field(min_length=1, max_length=5000)]
    file_url: Annotated[str | None, Field(max_length=2048)] = None


# the shape we return for a single deliverable in the revision trail
class DeliverableOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy Deliverable row
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contract_id: uuid.UUID
    submitted_by: uuid.UUID
    version_number: int
    message: str
    file_url: str | None
    status: DeliverableStatus
    revision_notes: str | None
    created_at: datetime
    updated_at: datetime


# validate request body for approving a deliverable (notes are optional praise)
class DeliverableApprove(BaseModel):
    # reject client-supplied id or any other unexpected fields
    model_config = ConfigDict(extra="forbid")

    revision_notes: Annotated[str | None, Field(max_length=5000)] = None


# validate request body for requesting a revision (feedback is required)
class DeliverableRevisionRequest(BaseModel):
    # reject client-supplied id or any other unexpected fields
    model_config = ConfigDict(extra="forbid")

    revision_notes: Annotated[str, Field(min_length=1, max_length=5000)]
