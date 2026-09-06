"""create project models

Revision ID: c8d2e5f6a7b9
Revises: b7f19c2d3e4f
Create Date: 2026-09-05 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# identify this revision after the user full-name migration
revision: str = "c8d2e5f6a7b9"
down_revision: Union[str, Sequence[str], None] = "b7f19c2d3e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# create project persistence and reusable skill associations for marketplace discovery
def upgrade() -> None:
    # store client-owned project requirements with money and lifecycle constraints
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("budget", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Enum("DRAFT", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED", name="projectstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("budget > 0", name="check_projects_budget_positive"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    # index ownership for client-side project actions and workspaces
    op.create_index(op.f("ix_projects_owner_id"), "projects", ["owner_id"], unique=False)
    # optimize public marketplace budget filtering by lifecycle status
    op.create_index("idx_projects_status_budget", "projects", ["status", "budget"], unique=False)
    # connect projects to existing normalized skills with one row per link
    op.create_table(
        "project_skills",
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("skill_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.PrimaryKeyConstraint("project_id", "skill_id"),
    )
    # optimize project skill replacement and skill-based marketplace filters
    op.create_index(
        "idx_project_skills_composite",
        "project_skills",
        ["project_id", "skill_id"],
        unique=False,
    )


# remove dependent links before their project and enum definitions
def downgrade() -> None:
    # drop the association index and table before dropping its referenced project table
    op.drop_index("idx_project_skills_composite", table_name="project_skills")
    op.drop_table("project_skills")
    # drop project indexes before removing the projects table
    op.drop_index("idx_projects_status_budget", table_name="projects")
    op.drop_index(op.f("ix_projects_owner_id"), table_name="projects")
    op.drop_table("projects")
    # remove the PostgreSQL enum only after no table depends on it
    sa.Enum(name="projectstatus").drop(op.get_bind(), checkfirst=True)
