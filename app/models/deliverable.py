import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


# define the deliverable review states used in marketplace workflow
class DeliverableStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REVISION_REQUESTED = "REVISION_REQUESTED"


# persist one immutable submission in a contract's delivery revision trail
class Deliverable(Base):
    __tablename__: str = "deliverables"
    __table_args__ = (
        # enforce one version per contract so revisions append instead of overwrite history
        UniqueConstraint("contract_id", "version_number", name="uq_deliverables_contract_version"),
        # optimize the common contract listing ordered by version trail
        Index("idx_deliverables_contract_id", "contract_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # link the deliverable to the contract whose work it delivers
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    # link the deliverable to the freelancer who submitted it
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # track the submission iteration within the contract, auto-assigned by the service
    version_number: Mapped[int] = mapped_column(nullable=False)
    # store the freelancer's summary of what was delivered
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # V1 scope: file delivery is a secure URL, not real object storage
    file_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    # status changes only through service actions, never direct request input
    status: Mapped[DeliverableStatus] = mapped_column(
        Enum(DeliverableStatus), default=DeliverableStatus.SUBMITTED, nullable=False
    )
    # store the client's feedback when a revision is requested
    revision_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
