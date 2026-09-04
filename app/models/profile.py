from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# join table for the many-to-many freelancer <-> skills relationship
freelancer_skills = Table(
    "freelancer_skills",
    Base.metadata,
    Column("freelancer_profile_id", ForeignKey("freelancer_profiles.id"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id"), primary_key=True),
    # composite index for fast candidate matching queries by skills
    Index("idx_freelancer_skills_composite", "freelancer_profile_id", "skill_id"),
)


# a reusable, normalized skill that many freelancers can share
class Skill(Base):
    __tablename__: str = "skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    # unique so the same skill can't be created twice
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)

    # back-reference: which freelancer profiles carry this skill
    freelancers: Mapped[list["FreelancerProfile"]] = relationship(
        secondary=freelancer_skills, back_populates="skills"
    )


# a client's public profile, one per user
class ClientProfile(Base):
    __tablename__: str = "client_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    # one client profile per user (unique FK)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    bio: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    # link back to the owning user account
    user: Mapped["User"] = relationship()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# a freelancer's public profile, one per user
class FreelancerProfile(Base):
    __tablename__: str = "freelancer_profiles"
    __table_args__ = (
        # enforce non-negative hourly rate at the database constraint level
        CheckConstraint("hourly_rate >= 0", name="check_freelancer_hourly_rate_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # one freelancer profile per user (unique FK)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    professional_title: Mapped[str | None] = mapped_column(String(100))
    bio: Mapped[str | None] = mapped_column(Text)
    # money is stored as fixed-precision Decimal, never a float
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # running aggregate rating stored as fixed-precision decimal
    avg_rating: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), server_default="0.00", default=Decimal("0.00"), nullable=False
    )
    # running counter of successfully completed projects
    completed_projects_count: Mapped[int] = mapped_column(
        Integer, server_default="0", default=0, nullable=False
    )

    user: Mapped["User"] = relationship()
    # the many-to-many link to skills
    skills: Mapped[list["Skill"]] = relationship(
        secondary=freelancer_skills, back_populates="freelancers"
    )
    # a freelancer can have many portfolio items
    portfolio_items: Mapped[list["PortfolioItem"]] = relationship(
        back_populates="freelancer_profile"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# a single example piece of work shown on a freelancer's profile
class PortfolioItem(Base):
    __tablename__: str = "portfolio_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    freelancer_profile_id: Mapped[int] = mapped_column(
        ForeignKey("freelancer_profiles.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(500))

    # back-reference to the owning freelancer profile
    freelancer_profile: Mapped["FreelancerProfile"] = relationship(
        back_populates="portfolio_items"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )