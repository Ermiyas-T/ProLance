"""add freelancer avatar URL

Revision ID: a7c9e1f3b5d7
Revises: f4a6b8c0d2e1
Create Date: 2026-09-20 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c9e1f3b5d7"
down_revision: Union[str, Sequence[str], None] = "f4a6b8c0d2e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # store the server-generated profile image URL for freelancer accounts
    op.add_column(
        "freelancer_profiles",
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    # remove freelancer avatar metadata when reverting the profile enhancement
    op.drop_column("freelancer_profiles", "avatar_url")
