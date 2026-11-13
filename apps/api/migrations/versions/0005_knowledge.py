"""Private approved knowledge sources.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

ACTOR = "NULLIF(current_setting('app.actor_id', true), '')"


def upgrade():
    op.create_table(
        "knowledge_sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("vault_id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("body", sa.String(12000), nullable=False),
        sa.Column("source_reference", sa.String(500), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("approved_by", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(16), nullable=False),
        sa.ForeignKeyConstraint(
            ["vault_id", "owner_id"], ["project_vaults.id", "project_vaults.created_by"]
        ),
        sa.CheckConstraint("status IN ('draft', 'approved', 'withdrawn')"),
        sa.CheckConstraint("status <> 'approved' OR approved_by IS NOT NULL"),
    )
    op.create_index("ix_knowledge_sources_vault_id", "knowledge_sources", ["vault_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE knowledge_sources FORCE ROW LEVEL SECURITY")
        op.execute(
            sa.text(
                "CREATE POLICY knowledge_read ON knowledge_sources FOR SELECT USING "
                f"(owner_id = {ACTOR} OR (status = 'approved' AND EXISTS "
                "(SELECT 1 FROM vault_memberships m WHERE m.vault_id = knowledge_sources.vault_id "
                f"AND m.user_id = {ACTOR})))"
            )
        )
        for action in ("INSERT", "UPDATE"):
            rule = f"WITH CHECK (owner_id = {ACTOR})"
            if action == "UPDATE":
                rule = f"USING (owner_id = {ACTOR}) " + rule
            op.execute(
                sa.text(
                    f"CREATE POLICY knowledge_{action.lower()} ON knowledge_sources "
                    f"FOR {action} {rule}"
                )
            )


def downgrade():
    op.drop_table("knowledge_sources")
