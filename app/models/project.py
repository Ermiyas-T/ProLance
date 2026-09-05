import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, CheckConstraint, DateTime, Enum, ForeignKey, Index, Numeric, String, Table, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# define the only project states allowed by the marketplace lifecycle
class ProjectStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# link reusable skills to project requirements without duplicating skill names
project_skills = Table(
    "project_skills",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id"), primary_key=True),
    # support project-to-skill lookups used when writing and filtering projects
    Index("idx_project_skills_composite", "project_id", "skill_id"),
)


# persist a client-owned request for freelance work and its lifecycle state
class Project(Base):
    __tablename__: str = "projects"
    __table_args__ = (
        # enforce positive budgets even when data bypasses the HTTP API
        CheckConstraint("budget > 0", name="check_projects_budget_positive"),
        # optimize the common marketplace status and budget filter combination
        Index("idx_projects_status_budget", "status", "budget"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # keep ownership on the user account rather than a mutable client profile
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # store budgets as Decimal-compatible fixed precision rather than floating point
    budget: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), default="USD", server_default="USD", nullable=False
    )
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # status changes only through service actions, never direct request input
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.DRAFT, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # connect a project to its owning account for object-level authorization
    owner: Mapped["User"] = relationship()
    # connect a project to reusable skills for discovery filters and API output
    skills: Mapped[list["Skill"]] = relationship(secondary=project_skills)
