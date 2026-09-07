from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.deliverable import DeliverableStatus


# validate request body for submitting a deliverable (V1: URL instead of file upload)
class DeliverableSubmit(BaseModel):
    message: Annotated[str, Field(min_length=1, max_length=5000)]
    file_url: Annotated[str | None, Field(max_length=2048)] = None


# the shape we return for a single deliverable in the revision trail
class DeliverableOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy Deliverable row
    model_config = ConfigDict(from_attributes=True)

    id: int
    contract_id: int
    submitted_by: int
    version_number: int
    message: str
    file_url: str | None
    status: DeliverableStatus
    revision_notes: str | None
    created_at: datetime
    updated_at: datetime


# validate request body for approving a deliverable (notes are optional praise)
class DeliverableApprove(BaseModel):
    revision_notes: Annotated[str | None, Field(max_length=5000)] = None


# validate request body for requesting a revision (feedback is required)
class DeliverableRevisionRequest(BaseModel):
    revision_notes: Annotated[str, Field(min_length=1, max_length=5000)]
