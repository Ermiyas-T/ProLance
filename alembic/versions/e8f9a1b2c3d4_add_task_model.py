"""add task model

Revision ID: e8f9a1b2c3d4
Revises: d7e71c5013f6
Create Date: 2026-09-06 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f9a1b2c3d4'
down_revision: Union[str, Sequence[str], None] = 'd7e71c5013f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # persist work items scoped to a contract
    op.create_table(
        'tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('TODO', 'IN_PROGRESS', 'DONE', name='taskstatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    # optimize common querying pattern: tasks for a contract sorted by creation time
    op.create_index('idx_tasks_contract_id', 'tasks', ['contract_id'], unique=False)
    # optimize filtering tasks by status within a contract
    op.create_index('idx_tasks_contract_status', 'tasks', ['contract_id', 'status'], unique=False)


def downgrade() -> None:
    # drop the indexes before dropping the tasks table
    op.drop_index('idx_tasks_contract_status', table_name='tasks')
    op.drop_index('idx_tasks_contract_id', table_name='tasks')
    op.drop_table('tasks')
    # remove the PostgreSQL enum after no table depends on it
    sa.Enum(name='taskstatus').drop(op.get_bind(), checkfirst=True)
