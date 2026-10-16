"""convert user ids and references to UUID

Revision ID: b2c3d4e5f6a7
Revises: 75ef68738386
Create Date: 2026-10-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "75ef68738386"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# keep every ownership/session reference aligned with the users primary key
USER_REFERENCE_COLUMNS = {
    "auth_sessions": ("user_id",),
    "client_profiles": ("user_id",),
    "freelancer_profiles": ("user_id",),
    "projects": ("owner_id",),
    "proposals": ("freelancer_id",),
    "contracts": ("client_id", "freelancer_id"),
    "deliverables": ("submitted_by",),
    "disputes": ("opened_by", "resolved_by"),
    "reviews": ("reviewer_id", "reviewee_id"),
}


def upgrade() -> None:
    """Replace the legacy integer user key while retaining existing relationships."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_id_type = next(column["type"] for column in inspector.get_columns("users") if column["name"] == "id")
    if not isinstance(user_id_type, sa.Integer):
        raise RuntimeError("Expected users.id to be integer before UUID migration")

    # assign each existing user a UUID before changing any dependent columns
    op.add_column("users", sa.Column("id_uuid", sa.Uuid(), nullable=True))
    op.execute(sa.text("UPDATE users SET id_uuid = gen_random_uuid()"))

    # translate each foreign key through the old-to-new user ID mapping
    for table_name, columns in USER_REFERENCE_COLUMNS.items():
        table_columns = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name in columns:
            if column_name not in table_columns:
                continue
            temporary_name = f"{column_name}_uuid"
            op.add_column(table_name, sa.Column(temporary_name, sa.Uuid(), nullable=True))
            op.execute(
                sa.text(
                    f'UPDATE "{table_name}" AS child '
                    f'SET "{temporary_name}" = parent."id_uuid" '
                    f'FROM users AS parent WHERE child."{column_name}" = parent.id'
                )
            )

    # remove user foreign keys and the primary key so the old columns can be replaced
    for table_name, columns in USER_REFERENCE_COLUMNS.items():
        for foreign_key in inspector.get_foreign_keys(table_name):
            if foreign_key.get("referred_table") == "users" and foreign_key.get("name"):
                op.drop_constraint(foreign_key["name"], table_name, type_="foreignkey")
    primary_key_name = inspector.get_pk_constraint("users").get("name")
    if primary_key_name:
        op.drop_constraint(primary_key_name, "users", type_="primary")

    # swap in the UUID columns after all references have been translated
    for table_name, columns in USER_REFERENCE_COLUMNS.items():
        table_columns = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name in columns:
            if column_name not in table_columns:
                continue
            nullable = next(
                column["nullable"]
                for column in inspector.get_columns(table_name)
                if column["name"] == column_name
            )
            op.drop_column(table_name, column_name)
            op.alter_column(table_name, f"{column_name}_uuid", new_column_name=column_name)
            op.alter_column(
                table_name,
                column_name,
                existing_type=sa.Uuid(),
                nullable=nullable,
            )
    op.drop_column("users", "id")
    op.alter_column("users", "id_uuid", new_column_name="id")
    op.alter_column(
        "users",
        "id",
        existing_type=sa.Uuid(),
        nullable=False,
        server_default=sa.text("gen_random_uuid()"),
    )

    # restore primary, foreign-key, uniqueness, and lookup constraints
    op.create_primary_key("users_pkey", "users", ["id"])
    for table_name, columns in USER_REFERENCE_COLUMNS.items():
        for column_name in columns:
            table_columns = {column["name"] for column in sa.inspect(bind).get_columns(table_name)}
            if column_name in table_columns:
                op.create_foreign_key(
                    f"fk_{table_name}_{column_name}_users",
                    table_name,
                    "users",
                    [column_name],
                    ["id"],
                )
    op.create_unique_constraint("uq_client_profiles_user_id", "client_profiles", ["user_id"])
    op.create_unique_constraint("uq_freelancer_profiles_user_id", "freelancer_profiles", ["user_id"])
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])
    op.create_index("ix_proposals_freelancer_id", "proposals", ["freelancer_id"])


def downgrade() -> None:
    """Restore integer user keys while preserving current user relationships."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # assign temporary integer keys so current UUID references remain connected
    op.add_column("users", sa.Column("id_integer", sa.Integer(), nullable=True))
    op.execute(
        sa.text(
            "WITH numbered AS ("
            "SELECT id, row_number() OVER (ORDER BY id) AS new_id FROM users"
            ") UPDATE users SET id_integer = numbered.new_id "
            "FROM numbered WHERE users.id = numbered.id"
        )
    )
    for table_name, columns in USER_REFERENCE_COLUMNS.items():
        table_columns = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name in columns:
            if column_name not in table_columns:
                continue
            temporary_name = f"{column_name}_integer"
            op.add_column(table_name, sa.Column(temporary_name, sa.Integer(), nullable=True))
            op.execute(
                sa.text(
                    f'UPDATE "{table_name}" AS child '
                    f'SET "{temporary_name}" = parent."id_integer" '
                    f'FROM users AS parent WHERE child."{column_name}" = parent.id'
                )
            )

    # drop UUID constraints before replacing the key and its references
    for table_name in USER_REFERENCE_COLUMNS:
        for foreign_key in inspector.get_foreign_keys(table_name):
            if foreign_key.get("referred_table") == "users" and foreign_key.get("name"):
                op.drop_constraint(foreign_key["name"], table_name, type_="foreignkey")
    primary_key_name = inspector.get_pk_constraint("users").get("name")
    if primary_key_name:
        op.drop_constraint(primary_key_name, "users", type_="primary")

    # swap the translated integer columns into place
    for table_name, columns in USER_REFERENCE_COLUMNS.items():
        table_columns = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name in columns:
            if column_name not in table_columns:
                continue
            nullable = next(
                column["nullable"]
                for column in inspector.get_columns(table_name)
                if column["name"] == column_name
            )
            op.drop_column(table_name, column_name)
            op.alter_column(table_name, f"{column_name}_integer", new_column_name=column_name)
            op.alter_column(
                table_name,
                column_name,
                existing_type=sa.Integer(),
                nullable=nullable,
            )
    op.drop_column("users", "id")
    op.alter_column("users", "id_integer", new_column_name="id")
    op.alter_column("users", "id", existing_type=sa.Integer(), nullable=False)

    # restore the original integer key constraints and indexes
    op.create_primary_key("users_pkey", "users", ["id"])
    for table_name, columns in USER_REFERENCE_COLUMNS.items():
        for column_name in columns:
            op.create_foreign_key(
                f"fk_{table_name}_{column_name}_users",
                table_name,
                "users",
                [column_name],
                ["id"],
            )
    op.create_unique_constraint("uq_client_profiles_user_id", "client_profiles", ["user_id"])
    op.create_unique_constraint("uq_freelancer_profiles_user_id", "freelancer_profiles", ["user_id"])
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])
    op.create_index("ix_proposals_freelancer_id", "proposals", ["freelancer_id"])