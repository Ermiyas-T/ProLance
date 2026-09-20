"""add currency to proposals and contracts

Revision ID: f4a6b8c0d2e1
Revises: 43fd4bb0f9ef
Create Date: 2026-09-20 15:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4a6b8c0d2e1"
down_revision: Union[str, Sequence[str], None] = "9c8e9eb700cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # add temporary nullable columns so existing rows can be backfilled safely
    op.add_column("proposals", sa.Column("currency", sa.String(length=3), nullable=True))
    op.add_column("contracts", sa.Column("currency", sa.String(length=3), nullable=True))

    # inherit the original project currency for historical proposal and contract prices
    op.execute(
        """
        UPDATE proposals
        SET currency = projects.currency
        FROM projects
        WHERE proposals.project_id = projects.id
        """
    )
    op.execute(
        """
        UPDATE contracts
        SET currency = projects.currency
        FROM projects
        WHERE contracts.project_id = projects.id
        """
    )

    # keep ETB as a defensive fallback for any legacy row without a project currency
    op.execute("UPDATE proposals SET currency = 'ETB' WHERE currency IS NULL")
    op.execute("UPDATE contracts SET currency = 'ETB' WHERE currency IS NULL")
    op.alter_column(
        "proposals",
        "currency",
        existing_type=sa.String(length=3),
        nullable=False,
        server_default="ETB",
    )
    op.alter_column(
        "contracts",
        "currency",
        existing_type=sa.String(length=3),
        nullable=False,
        server_default="ETB",
    )


def downgrade() -> None:
    # remove the currency snapshots when reverting this schema change
    op.drop_column("contracts", "currency")
    op.drop_column("proposals", "currency")
