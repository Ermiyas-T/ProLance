"""align profile identifiers and add avatar storage metadata

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Align profile IDs with SQLAlchemy and retain freelancer relationships."""
    # Create stable UUID replacements before changing profile IDs or references.
    for table_name in ("client_profiles", "freelancer_profiles", "portfolio_items"):
        op.add_column(table_name, sa.Column("id_uuid", sa.Uuid(), nullable=True))
        op.execute(sa.text(f'UPDATE "{table_name}" SET id_uuid = gen_random_uuid()'))

    # Map freelancer child rows to each profile's replacement UUID.
    op.add_column("freelancer_skills", sa.Column("freelancer_profile_id_uuid", sa.Uuid(), nullable=True))
    op.execute(
        sa.text(
            "UPDATE freelancer_skills AS child "
            "SET freelancer_profile_id_uuid = parent.id_uuid "
            "FROM freelancer_profiles AS parent "
            "WHERE child.freelancer_profile_id = parent.id"
        )
    )
    op.add_column("portfolio_items", sa.Column("freelancer_profile_id_uuid", sa.Uuid(), nullable=True))
    op.execute(
        sa.text(
            "UPDATE portfolio_items AS child "
            "SET freelancer_profile_id_uuid = parent.id_uuid "
            "FROM freelancer_profiles AS parent "
            "WHERE child.freelancer_profile_id = parent.id"
        )
    )

    # Remove constraints that depend on the integer IDs before swapping columns.
    op.drop_constraint("freelancer_skills_freelancer_profile_id_fkey", "freelancer_skills", type_="foreignkey")
    op.drop_constraint("portfolio_items_freelancer_profile_id_fkey", "portfolio_items", type_="foreignkey")
    op.drop_constraint("client_profiles_pkey", "client_profiles", type_="primary")
    op.drop_constraint("freelancer_profiles_pkey", "freelancer_profiles", type_="primary")
    op.drop_constraint("freelancer_skills_pkey", "freelancer_skills", type_="primary")
    op.drop_constraint("portfolio_items_pkey", "portfolio_items", type_="primary")

    # Replace the freelancer relationship columns with their mapped UUID values.
    op.drop_column("freelancer_skills", "freelancer_profile_id")
    op.alter_column("freelancer_skills", "freelancer_profile_id_uuid", new_column_name="freelancer_profile_id")
    op.alter_column("freelancer_skills", "freelancer_profile_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_column("portfolio_items", "freelancer_profile_id")
    op.alter_column("portfolio_items", "freelancer_profile_id_uuid", new_column_name="freelancer_profile_id")
    op.alter_column("portfolio_items", "freelancer_profile_id", existing_type=sa.Uuid(), nullable=False)

    # Replace the old integer primary keys with server-generated UUID keys.
    for table_name in ("client_profiles", "freelancer_profiles", "portfolio_items"):
        op.drop_column(table_name, "id")
        op.alter_column(table_name, "id_uuid", new_column_name="id")
        op.alter_column(
            table_name,
            "id",
            existing_type=sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        )

    # Restore primary keys, profile foreign keys, and the skill lookup index.
    op.create_primary_key("client_profiles_pkey", "client_profiles", ["id"])
    op.create_primary_key("freelancer_profiles_pkey", "freelancer_profiles", ["id"])
    op.create_primary_key("freelancer_skills_pkey", "freelancer_skills", ["freelancer_profile_id", "skill_id"])
    op.create_primary_key("portfolio_items_pkey", "portfolio_items", ["id"])
    op.create_foreign_key(
        "freelancer_skills_freelancer_profile_id_fkey",
        "freelancer_skills",
        "freelancer_profiles",
        ["freelancer_profile_id"],
        ["id"],
    )
    op.create_foreign_key(
        "portfolio_items_freelancer_profile_id_fkey",
        "portfolio_items",
        "freelancer_profiles",
        ["freelancer_profile_id"],
        ["id"],
    )
    op.create_index(
        "idx_freelancer_skills_composite",
        "freelancer_skills",
        ["freelancer_profile_id", "skill_id"],
    )

    # Bring profile columns into line with the model defaults and Cloudinary storage.
    op.add_column(
        "freelancer_profiles",
        sa.Column("currency", sa.String(length=3), server_default="ETB", nullable=False),
    )
    op.add_column("client_profiles", sa.Column("avatar_public_id", sa.String(length=255), nullable=True))
    op.add_column("freelancer_profiles", sa.Column("avatar_public_id", sa.String(length=255), nullable=True))

    # Remove local file URLs without touching externally hosted legacy avatars.
    # The cleared local URLs cannot be restored by downgrade; back up before rollout.
    for table_name in ("client_profiles", "freelancer_profiles"):
        op.execute(
            sa.text(
                f'UPDATE "{table_name}" SET avatar_url = NULL '
                "WHERE avatar_url LIKE '%/uploads/avatars/%'"
            )
        )


def downgrade() -> None:
    """Restore integer IDs; cleared local avatar URLs are intentionally not restored."""
    # Create temporary mappings so all profile references stay connected on downgrade.
    op.execute(
        sa.text(
            "CREATE TEMP TABLE client_profile_id_map ON COMMIT DROP AS "
            "SELECT id AS uuid_id, row_number() OVER (ORDER BY id)::integer AS int_id FROM client_profiles"
        )
    )
    op.execute(
        sa.text(
            "CREATE TEMP TABLE freelancer_profile_id_map ON COMMIT DROP AS "
            "SELECT id AS uuid_id, row_number() OVER (ORDER BY id)::integer AS int_id FROM freelancer_profiles"
        )
    )
    op.execute(
        sa.text(
            "CREATE TEMP TABLE portfolio_item_id_map ON COMMIT DROP AS "
            "SELECT id AS uuid_id, row_number() OVER (ORDER BY id)::integer AS int_id FROM portfolio_items"
        )
    )
    op.add_column("client_profiles", sa.Column("id_integer", sa.Integer(), nullable=True))
    op.execute(
        sa.text(
            "UPDATE client_profiles AS profile SET id_integer = mapping.int_id "
            "FROM client_profile_id_map AS mapping WHERE profile.id = mapping.uuid_id"
        )
    )
    op.add_column("freelancer_profiles", sa.Column("id_integer", sa.Integer(), nullable=True))
    op.execute(
        sa.text(
            "UPDATE freelancer_profiles AS profile SET id_integer = mapping.int_id "
            "FROM freelancer_profile_id_map AS mapping WHERE profile.id = mapping.uuid_id"
        )
    )
    op.add_column("portfolio_items", sa.Column("id_integer", sa.Integer(), nullable=True))
    op.execute(
        sa.text(
            "UPDATE portfolio_items AS item SET id_integer = mapping.int_id "
            "FROM portfolio_item_id_map AS mapping WHERE item.id = mapping.uuid_id"
        )
    )
    for table_name in ("freelancer_skills", "portfolio_items"):
        op.add_column(table_name, sa.Column("freelancer_profile_id_integer", sa.Integer(), nullable=True))
        op.execute(
            sa.text(
                f'UPDATE "{table_name}" AS child SET freelancer_profile_id_integer = mapping.int_id '
                "FROM freelancer_profile_id_map AS mapping "
                "WHERE child.freelancer_profile_id = mapping.uuid_id"
            )
        )

    # Drop UUID-dependent keys before swapping the integer replacement columns in.
    op.drop_index("idx_freelancer_skills_composite", table_name="freelancer_skills")
    op.drop_constraint("freelancer_skills_freelancer_profile_id_fkey", "freelancer_skills", type_="foreignkey")
    op.drop_constraint("portfolio_items_freelancer_profile_id_fkey", "portfolio_items", type_="foreignkey")
    op.drop_constraint("client_profiles_pkey", "client_profiles", type_="primary")
    op.drop_constraint("freelancer_profiles_pkey", "freelancer_profiles", type_="primary")
    op.drop_constraint("freelancer_skills_pkey", "freelancer_skills", type_="primary")
    op.drop_constraint("portfolio_items_pkey", "portfolio_items", type_="primary")

    # Restore integer freelancer relationship columns from the temporary mappings.
    for table_name in ("freelancer_skills", "portfolio_items"):
        op.drop_column(table_name, "freelancer_profile_id")
        op.alter_column(table_name, "freelancer_profile_id_integer", new_column_name="freelancer_profile_id")
        op.alter_column(table_name, "freelancer_profile_id", existing_type=sa.Integer(), nullable=False)

    # Restore integer primary keys and create owned sequences for future rows.
    for table_name in ("client_profiles", "freelancer_profiles", "portfolio_items"):
        op.drop_column(table_name, "id")
        op.alter_column(table_name, "id_integer", new_column_name="id")
        op.alter_column(table_name, "id", existing_type=sa.Integer(), nullable=False)
        sequence_name = f"{table_name}_id_seq"
        op.execute(sa.text(f'CREATE SEQUENCE "{sequence_name}"'))
        op.alter_column(
            table_name,
            "id",
            existing_type=sa.Integer(),
            server_default=sa.text(f"nextval('{sequence_name}'::regclass)"),
        )
        op.execute(sa.text(f'ALTER SEQUENCE "{sequence_name}" OWNED BY "{table_name}".id'))
        op.execute(
            sa.text(
                f"SELECT setval('{sequence_name}', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) "
                f'FROM "{table_name}"'
            )
        )

    # Restore original relational constraints and remove Cloudinary-only metadata.
    op.create_primary_key("client_profiles_pkey", "client_profiles", ["id"])
    op.create_primary_key("freelancer_profiles_pkey", "freelancer_profiles", ["id"])
    op.create_primary_key("freelancer_skills_pkey", "freelancer_skills", ["freelancer_profile_id", "skill_id"])
    op.create_primary_key("portfolio_items_pkey", "portfolio_items", ["id"])
    op.create_foreign_key(
        "freelancer_skills_freelancer_profile_id_fkey",
        "freelancer_skills",
        "freelancer_profiles",
        ["freelancer_profile_id"],
        ["id"],
    )
    op.create_foreign_key(
        "portfolio_items_freelancer_profile_id_fkey",
        "portfolio_items",
        "freelancer_profiles",
        ["freelancer_profile_id"],
        ["id"],
    )
    op.create_index(
        "idx_freelancer_skills_composite",
        "freelancer_skills",
        ["freelancer_profile_id", "skill_id"],
    )
    op.drop_column("client_profiles", "avatar_public_id")
    op.drop_column("freelancer_profiles", "avatar_public_id")
    op.drop_column("freelancer_profiles", "currency")