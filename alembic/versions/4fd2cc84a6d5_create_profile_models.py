"""create profile models

Revision ID: 4fd2cc84a6d5
Revises: 8a4c51dba45c
Create Date: 2026-09-05 07:42:21.113533

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fd2cc84a6d5'
down_revision: Union[str, Sequence[str], None] = '8a4c51dba45c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # create skills table for reusable normalized skill names
    op.create_table('skills',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    # index and enforce uniqueness on skill names for fast lookup
    op.create_index(op.f('ix_skills_name'), 'skills', ['name'], unique=True)
    # create client profile table linked 1-to-1 with a user
    op.create_table('client_profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('display_name', sa.String(length=100), nullable=False),
    sa.Column('bio', sa.Text(), nullable=True),
    sa.Column('location', sa.String(length=100), nullable=True),
    sa.Column('avatar_url', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    # create freelancer profile table with rate and rating constraints
    op.create_table('freelancer_profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('professional_title', sa.String(length=100), nullable=True),
    sa.Column('bio', sa.Text(), nullable=True),
    sa.Column('hourly_rate', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('avg_rating', sa.Numeric(precision=3, scale=2), server_default='0.00', nullable=False),
    sa.Column('completed_projects_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('hourly_rate >= 0', name='check_freelancer_hourly_rate_non_negative'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    # create join table linking freelancer profiles to skills (many-to-many)
    op.create_table('freelancer_skills',
    sa.Column('freelancer_profile_id', sa.Integer(), nullable=False),
    sa.Column('skill_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['freelancer_profile_id'], ['freelancer_profiles.id'], ),
    sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ),
    sa.PrimaryKeyConstraint('freelancer_profile_id', 'skill_id')
    )
    # composite index for fast skill-based freelancer candidate searches
    op.create_index('idx_freelancer_skills_composite', 'freelancer_skills', ['freelancer_profile_id', 'skill_id'], unique=False)
    # create portfolio items table for samples of freelancer work
    op.create_table('portfolio_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('freelancer_profile_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('url', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['freelancer_profile_id'], ['freelancer_profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # drop child table portfolio items before parent freelancer profile
    op.drop_table('portfolio_items')
    # drop composite index before dropping join table
    op.drop_index('idx_freelancer_skills_composite', table_name='freelancer_skills')
    # drop many-to-many join table before dropping profiles and skills
    op.drop_table('freelancer_skills')
    # drop freelancer profiles table
    op.drop_table('freelancer_profiles')
    # drop client profiles table
    op.drop_table('client_profiles')
    # drop skills index and table
    op.drop_index(op.f('ix_skills_name'), table_name='skills')
    op.drop_table('skills')
