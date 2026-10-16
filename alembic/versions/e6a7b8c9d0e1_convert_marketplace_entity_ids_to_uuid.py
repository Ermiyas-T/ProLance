"""convert marketplace entity ids to uuid

Revision ID: e6a7b8c9d0e1
Revises: d5e6f7a8b9c0
Create Date: 2026-10-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# tables whose own primary key changes from integer to uuid
PRIMARY_KEY_TABLES = {
    "projects": "id",
    "proposals": "id",
    "contracts": "id",
    "deliverables": "id",
    "disputes": "id",
    "reviews": "id",
    "tasks": "id",
}

# foreign-key column -> (parent table, parent primary key) that must follow the parent to uuid
FOREIGN_KEY_COLUMNS = {
    "project_skills": {"project_id": ("projects", "id")},
    "proposals": {"project_id": ("projects", "id")},
    "contracts": {"project_id": ("projects", "id"), "proposal_id": ("proposals", "id")},
    "deliverables": {"contract_id": ("contracts", "id")},
    "disputes": {"contract_id": ("contracts", "id")},
    "reviews": {"contract_id": ("contracts", "id")},
    "tasks": {"contract_id": ("contracts", "id")},
}

# incoming FKs must be dropped before the referenced integer columns can be replaced
INCOMING_FOREIGN_KEYS = [
    ("project_skills", "project_skills_project_id_fkey"),
    ("proposals", "proposals_project_id_fkey"),
    ("contracts", "contracts_project_id_fkey"),
    ("contracts", "contracts_proposal_id_fkey"),
    ("deliverables", "deliverables_contract_id_fkey"),
    ("disputes", "disputes_contract_id_fkey"),
    ("reviews", "reviews_contract_id_fkey"),
    ("tasks", "tasks_contract_id_fkey"),
]

# uniqueness rules that include a converted column and must be rebuilt afterwards
UNIQUE_CONSTRAINTS = [
    ("uq_contracts_project_id", "contracts", ["project_id"]),
    ("uq_contracts_proposal_id", "contracts", ["proposal_id"]),
    ("uq_deliverables_contract_version", "deliverables", ["contract_id", "version_number"]),
    ("uq_reviews_contract_reviewer", "reviews", ["contract_id", "reviewer_id"]),
]

# lookup indexes that include a converted column and must be rebuilt afterwards
LOOKUP_INDEXES = [
    ("idx_project_skills_composite", "project_skills", ["project_id", "skill_id"]),
    ("ix_proposals_project_id", "proposals", ["project_id"]),
    ("idx_proposals_project_status", "proposals", ["project_id", "status"]),
    ("idx_deliverables_contract_id", "deliverables", ["contract_id"]),
    ("idx_tasks_contract_id", "tasks", ["contract_id"]),
    ("idx_tasks_contract_status", "tasks", ["contract_id", "status"]),
]


# recreate the constraints/indexes that were destroyed while swapping the columns
def _create_constraints() -> None:
    # restore each table's primary key over its newly typed id column
    op.create_primary_key("projects_pkey", "projects", ["id"])
    op.create_primary_key("proposals_pkey", "proposals", ["id"])
    op.create_primary_key("contracts_pkey", "contracts", ["id"])
    op.create_primary_key("deliverables_pkey", "deliverables", ["id"])
    op.create_primary_key("disputes_pkey", "disputes", ["id"])
    op.create_primary_key("reviews_pkey", "reviews", ["id"])
    op.create_primary_key("tasks_pkey", "tasks", ["id"])
    # the association table has a composite key that includes the converted project_id
    op.create_primary_key("project_skills_pkey", "project_skills", ["project_id", "skill_id"])

    # rebuild the uniqueness rules that previously sat on the integer columns
    for name, table, columns in UNIQUE_CONSTRAINTS:
        op.create_unique_constraint(name, table, columns)

    # rebuild the foreign keys now that both sides are uuid
    op.create_foreign_key("project_skills_project_id_fkey", "project_skills", "projects", ["project_id"], ["id"])
    op.create_foreign_key("proposals_project_id_fkey", "proposals", "projects", ["project_id"], ["id"])
    op.create_foreign_key("contracts_project_id_fkey", "contracts", "projects", ["project_id"], ["id"])
    op.create_foreign_key("contracts_proposal_id_fkey", "contracts", "proposals", ["proposal_id"], ["id"])
    op.create_foreign_key("deliverables_contract_id_fkey", "deliverables", "contracts", ["contract_id"], ["id"])
    op.create_foreign_key("disputes_contract_id_fkey", "disputes", "contracts", ["contract_id"], ["id"])
    op.create_foreign_key("reviews_contract_id_fkey", "reviews", "contracts", ["contract_id"], ["id"])
    op.create_foreign_key("tasks_contract_id_fkey", "tasks", "contracts", ["contract_id"], ["id"])

    # rebuild the lookup indexes needed by the marketplace and contract queries
    for name, table, columns in LOOKUP_INDEXES:
        op.create_index(name, table, columns)


# replace every legacy integer identifier with a UUID while keeping relationships intact
def upgrade() -> None:
    """Convert the marketplace entity keys and their references to UUID."""
    # 1. give every primary-key table a UUID while rows still keep their integer key
    for table_name, primary_key in PRIMARY_KEY_TABLES.items():
        op.add_column(table_name, sa.Column(f"{primary_key}_uuid", sa.Uuid(), nullable=True))
        op.execute(sa.text(f'UPDATE "{table_name}" SET "{primary_key}_uuid" = gen_random_uuid()'))

    # 2. translate each foreign key through its parent's freshly generated UUID
    for child_table, columns in FOREIGN_KEY_COLUMNS.items():
        for column_name, (parent_table, parent_key) in columns.items():
            op.add_column(child_table, sa.Column(f"{column_name}_uuid", sa.Uuid(), nullable=True))
            op.execute(
                sa.text(
                    f'UPDATE "{child_table}" AS child '
                    f'SET "{column_name}_uuid" = parent."{parent_key}_uuid" '
                    f'FROM "{parent_table}" AS parent '
                    f'WHERE child."{column_name}" = parent."{parent_key}"'
                )
            )

    # 3. incoming foreign keys block dropping the referenced integer columns
    for table_name, constraint_name in INCOMING_FOREIGN_KEYS:
        op.drop_constraint(constraint_name, table_name, type_="foreignkey")

    # 4. drop the integer columns; Postgres removes the local indexes/keys that depend on them
    for child_table, columns in FOREIGN_KEY_COLUMNS.items():
        for column_name in columns:
            op.drop_column(child_table, column_name)
    for table_name, primary_key in PRIMARY_KEY_TABLES.items():
        op.drop_column(table_name, primary_key)

    # 5. promote the UUID replacements and match the models' not-null + server defaults
    for table_name, primary_key in PRIMARY_KEY_TABLES.items():
        op.alter_column(table_name, f"{primary_key}_uuid", new_column_name=primary_key)
        op.alter_column(
            table_name,
            primary_key,
            existing_type=sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        )
    for child_table, columns in FOREIGN_KEY_COLUMNS.items():
        for column_name in columns:
            op.alter_column(child_table, f"{column_name}_uuid", new_column_name=column_name)
            op.alter_column(child_table, column_name, existing_type=sa.Uuid(), nullable=False)

    # 6. restore integrity constraints and query indexes on the uuid schema
    _create_constraints()


def downgrade() -> None:
    """Restore integer keys while retaining current relationships and new rows."""
    # 1. assign each entity an integer replacement derived from its current UUID
    for table_name, primary_key in PRIMARY_KEY_TABLES.items():
        op.add_column(table_name, sa.Column(f"{primary_key}_integer", sa.Integer(), nullable=True))
        op.execute(
            sa.text(
                f'WITH numbered AS (SELECT "{primary_key}" AS uuid_id, '
                f'row_number() OVER (ORDER BY "{primary_key}") AS int_id FROM "{table_name}") '
                f'UPDATE "{table_name}" SET "{primary_key}_integer" = numbered.int_id '
                f'FROM numbered WHERE "{table_name}"."{primary_key}" = numbered.uuid_id'
            )
        )

    # 2. map each foreign key back through its parent's integer replacement
    for child_table, columns in FOREIGN_KEY_COLUMNS.items():
        for column_name, (parent_table, parent_key) in columns.items():
            op.add_column(child_table, sa.Column(f"{column_name}_integer", sa.Integer(), nullable=True))
            op.execute(
                sa.text(
                    f'UPDATE "{child_table}" AS child '
                    f'SET "{column_name}_integer" = parent."{parent_key}_integer" '
                    f'FROM "{parent_table}" AS parent '
                    f'WHERE child."{column_name}" = parent."{parent_key}"'
                )
            )

    # 3. drop incoming foreign keys before removing the referenced UUID columns
    for table_name, constraint_name in INCOMING_FOREIGN_KEYS:
        op.drop_constraint(constraint_name, table_name, type_="foreignkey")

    # 4. remove the UUID columns (and their dependent local keys/indexes)
    for child_table, columns in FOREIGN_KEY_COLUMNS.items():
        for column_name in columns:
            op.drop_column(child_table, column_name)
    for table_name, primary_key in PRIMARY_KEY_TABLES.items():
        op.drop_column(table_name, primary_key)

    # 5. promote the integer replacements and give primary keys an owned sequence
    for table_name, primary_key in PRIMARY_KEY_TABLES.items():
        op.alter_column(table_name, f"{primary_key}_integer", new_column_name=primary_key)
        op.alter_column(table_name, primary_key, existing_type=sa.Integer(), nullable=False)
        sequence_name = f"{table_name}_id_seq"
        op.execute(sa.text(f'CREATE SEQUENCE "{sequence_name}"'))
        op.alter_column(
            table_name,
            primary_key,
            existing_type=sa.Integer(),
            server_default=sa.text(f"nextval('{sequence_name}'::regclass)"),
        )
        op.execute(sa.text(f'ALTER SEQUENCE "{sequence_name}" OWNED BY "{table_name}"."{primary_key}"'))
        op.execute(
            sa.text(
                f'SELECT setval(\'{sequence_name}\', COALESCE(MAX("{primary_key}"), 1), '
                f'MAX("{primary_key}") IS NOT NULL) FROM "{table_name}"'
            )
        )
    for child_table, columns in FOREIGN_KEY_COLUMNS.items():
        for column_name in columns:
            op.alter_column(child_table, f"{column_name}_integer", new_column_name=column_name)
            op.alter_column(child_table, column_name, existing_type=sa.Integer(), nullable=False)

    # 6. restore the same integrity constraints and indexes over the integer schema
    _create_constraints()
