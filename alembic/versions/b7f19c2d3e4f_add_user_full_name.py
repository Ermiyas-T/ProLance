"""add user full name

Revision ID: b7f19c2d3e4f
Revises: 4fd2cc84a6d5
Create Date: 2026-09-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7f19c2d3e4f'
down_revision: Union[str, Sequence[str], None] = '4fd2cc84a6d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # restore the account-level identity column that role profiles no longer carry
    op.add_column('users', sa.Column('full_name', sa.String(length=120), nullable=False, server_default=''))
    # remove the temporary default once every row has the column populated
    op.alter_column('users', 'full_name', server_default=None)


def downgrade() -> None:
    # drop the identity column when rolling back past this revision
    op.drop_column('users', 'full_name')
