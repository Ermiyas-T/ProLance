import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.contract import Contract


# define the admin moderation workflow states for a dispute
class DisputeStatus(str, enum.Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"


# persist a participant-raised issue on a contract that admins moderate
class Dispute(Base):
    __tablename__: str = "disputes"
    __table_args__ = (
        # optimize the admin queue query: unresolved disputes by recency
        Index("idx_disputes_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # link the dispute to the contract it concerns
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    # load the disputed contract directly for participant visibility checks
    contract: Mapped["Contract"] = relationship()
    # link the dispute to the participant who raised it
    opened_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # short headline summarizing the issue for queue scanning
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # full free-form description of the problem from the opener's perspective
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # status changes only through admin service actions, never request input
    status: Mapped[DisputeStatus] = mapped_column(
        Enum(DisputeStatus), default=DisputeStatus.OPEN, nullable=False
    )
    # admin's final decision notes, stored when the dispute is resolved
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    # link the admin who resolved the dispute for accountability
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
