"""default project currency to ETB

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-10-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Align the project currency default with the platform-wide ETB convention."""
    # only the column default changes here; existing rows are deliberately left as-is
    # because a stored "USD" may be an explicit currency choice rather than a default artefact
    op.alter_column(
        "projects",
        "currency",
        existing_type=sa.String(length=3),
        server_default="ETB",
    )


def downgrade() -> None:
    """Restore the previous USD default for the project currency column."""
    op.alter_column(
        "projects",
        "currency",
        existing_type=sa.String(length=3),
        server_default="USD",
    )
