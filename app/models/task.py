import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


# define the task lifecycle states used in marketplace workflow
class TaskStatus(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


# persist work items scoped to a contract
class Task(Base):
    __tablename__: str = "tasks"
    __table_args__ = (
        # optimize common querying pattern: tasks for a contract sorted by creation time
        Index("idx_tasks_contract_id", "contract_id"),
        # optimize filtering tasks by status within a contract
        Index("idx_tasks_contract_status", "contract_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # link the task to the contract it belongs to
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    # brief summary of what needs to be done
    title: Mapped[str] = mapped_column(nullable=False)
    # optional detailed description of the task
    description: Mapped[str | None] = mapped_column(nullable=True)
    # status transitions only through service actions, never direct request input
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.TODO, nullable=False
    )
    # track when the task was created
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # track when the task was last modified
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
