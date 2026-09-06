import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


# define the proposal lifecycle states used in marketplace workflow
class ProposalStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


# persist a freelancer's bid to work on a published project
class Proposal(Base):
    __tablename__: str = "proposals"
    __table_args__ = (
        # enforce positive pricing and delivery estimates even when data bypasses the HTTP API
        CheckConstraint(
            "proposed_price > 0 AND delivery_days > 0",
            name="check_proposals_positive_values",
        ),
        # prevent duplicate active proposals from the same freelancer on the same project
        Index(
            "idx_proposals_project_freelancer_pending",
            "project_id",
            "freelancer_id",
            unique=True,
            postgresql_where="status = 'PENDING'",
        ),
        # optimize the common project proposal listing and status filtering pattern
        Index("idx_proposals_project_status", "project_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # link the proposal to the project being bid on
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )
    # link the proposal to the freelancer submitting the bid
    freelancer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    # store the freelancer's quoted price as Decimal-compatible fixed precision
    proposed_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # store the freelancer's estimated delivery time in days
    delivery_days: Mapped[int] = mapped_column(nullable=False)
    # store the freelancer's pitch to the client
    cover_letter: Mapped[str] = mapped_column(Text, nullable=False)
    # status changes only through service actions, never direct request input
    status: Mapped[ProposalStatus] = mapped_column(
        Enum(ProposalStatus), default=ProposalStatus.PENDING, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # connect a proposal to the project it bids on for authorization checks
    project: Mapped["Project"] = relationship()
    # connect a proposal to the submitting freelancer for identity verification
    freelancer: Mapped["User"] = relationship()
