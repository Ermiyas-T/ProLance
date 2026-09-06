from datetime import datetime
from typing import Annotated

import enum
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskStatus


# limits valid task status transitions to the allowed lifecycle states
class TaskStatusInput(str, enum.Enum):
    TODO = TaskStatus.TODO.value
    IN_PROGRESS = TaskStatus.IN_PROGRESS.value
    DONE = TaskStatus.DONE.value


# validate request body for creating a new task
class TaskCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=255)]
    description: Annotated[str | None, Field(max_length=5000)] = None


# validate request body for updating an existing task
class TaskUpdate(BaseModel):
    title: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    description: Annotated[str | None, Field(max_length=5000)] = None
    status: Annotated[TaskStatusInput | None] = None


# the shape we return for a single task
class TaskOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy Task row
    model_config = ConfigDict(from_attributes=True)

    id: int
    contract_id: int
    title: str
    description: str | None
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
