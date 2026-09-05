from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.contract import ContractStatus


# describe an individual contract returned from a persisted SQLAlchemy row
class ContractOut(BaseModel):
    # allow FastAPI to serialize SQLAlchemy models
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    proposal_id: int
    client_id: int
    freelancer_id: int
    agreed_price: Decimal
    deadline: datetime
    status: ContractStatus
    created_at: datetime
    updated_at: datetime


# return a predictable envelope for growing contract result sets
class ContractListOut(BaseModel):
    items: list[ContractOut]
    total: int
    page: int
    page_size: int
