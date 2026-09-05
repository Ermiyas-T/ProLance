import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


# define the contract lifecycle states used in marketplace workflow
class ContractStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# persist the binding agreement between client and freelancer after proposal acceptance
class Contract(Base):
    __tablename__: str = "contracts"
    __table_args__ = (
        # enforce one contract per project to prevent multiple concurrent contracts
        UniqueConstraint("project_id", name="uq_contracts_project_id"),
        # enforce one contract per proposal to prevent duplicate acceptance
        UniqueConstraint("proposal_id", name="uq_contracts_proposal_id"),
        # optimize the common participant dashboard queries with status filtering
        Index("idx_contracts_participants", "client_id", "freelancer_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # link the contract to the project being worked on
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, unique=True)
    # link the contract to the accepted proposal (single source of truth)
    proposal_id: Mapped[int] = mapped_column(ForeignKey("proposals.id"), nullable=False, unique=True)
    # link the contract to the client who owns the project
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # link the contract to the freelancer who submitted the accepted proposal
    freelancer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # store the agreed price as Decimal-compatible fixed precision
    agreed_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # store the contract deadline from the project or negotiation
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # status changes only through service actions, never direct request input
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus), default=ContractStatus.ACTIVE, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
