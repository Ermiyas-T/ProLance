"""merge migration heads

Revision ID: 75ef68738386
Revises: 1a2b3c4d5e6f, a7c9e1f3b5d7
Create Date: 2026-09-21 21:41:17.219013

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75ef68738386'
down_revision: Union[str, Sequence[str], None] = ('1a2b3c4d5e6f', 'a7c9e1f3b5d7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
