"""Forced PostgreSQL RLS with non-recursive ownership checks.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

ACTOR = "NULLIF(current_setting('app.actor_id', true), '')"


def upgrade():
    op.create_index("uq_vault_owner", "project_vaults", ["id", "created_by"], unique=True)
    for table, fk in (
        ("vault_memberships", "fk_membership_vault_owner"),
        ("vault_events", "fk_event_vault_owner"),
    ):
        op.add_column(table, sa.Column("owner_id", sa.String(36), nullable=True))
        op.execute(
            sa.text(
                f"UPDATE {table} SET owner_id = (SELECT created_by FROM project_vaults "
                f"WHERE project_vaults.id = {table}.vault_id)"
            )
        )
        with op.batch_alter_table(table) as batch:
            batch.alter_column("owner_id", existing_type=sa.String(36), nullable=False)
            batch.create_foreign_key(
                fk, "project_vaults", ["vault_id", "owner_id"], ["id", "created_by"]
            )
            if table == "vault_memberships":
                batch.create_check_constraint(
                    "ck_membership_owner_identity", "role <> 'owner' OR user_id = owner_id"
                )
    if op.get_bind().dialect.name != "postgresql":
        return  # SQLite is for local development only; it does not implement RLS.
    policies = {
        "project_vaults": {
            "read": f"FOR SELECT USING (created_by = {ACTOR} OR EXISTS "
            f"(SELECT 1 FROM vault_memberships m WHERE m.vault_id = project_vaults.id "
            f"AND m.user_id = {ACTOR}))",
            "create": f"FOR INSERT WITH CHECK (created_by = {ACTOR})",
        },
        "vault_memberships": {
            "read": f"FOR SELECT USING (user_id = {ACTOR} OR owner_id = {ACTOR})",
            "create": f"FOR INSERT WITH CHECK (owner_id = {ACTOR})",
            "revoke": f"FOR DELETE USING (owner_id = {ACTOR} AND role <> 'owner')",
        },
        "vault_events": {
            "read": f"FOR SELECT USING (owner_id = {ACTOR})",
            "create": f"FOR INSERT WITH CHECK (owner_id = {ACTOR} AND actor_id = {ACTOR})",
        },
    }
    for table, rules in policies.items():
        op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
        for action, rule in rules.items():
            op.execute(sa.text(f"CREATE POLICY {table}_{action} ON {table} {rule}"))


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        for table, actions in (
            ("project_vaults", ("read", "create")),
            ("vault_memberships", ("read", "create", "revoke")),
            ("vault_events", ("read", "create")),
        ):
            for action in actions:
                op.execute(sa.text(f"DROP POLICY {table}_{action} ON {table}"))
            op.execute(sa.text(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY"))
            op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
    for table, fk in (
        ("vault_events", "fk_event_vault_owner"),
        ("vault_memberships", "fk_membership_vault_owner"),
    ):
        with op.batch_alter_table(table) as batch:
            if table == "vault_memberships":
                batch.drop_constraint("ck_membership_owner_identity", type_="check")
            batch.drop_constraint(fk, type_="foreignkey")
            batch.drop_column("owner_id")
    op.drop_index("uq_vault_owner", table_name="project_vaults")
