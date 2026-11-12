"""private project boundaries

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project_vaults",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "vault_memberships",
        sa.Column("vault_id", sa.String(36), sa.ForeignKey("project_vaults.id"), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("role", sa.String(12), nullable=False),
        sa.CheckConstraint("role IN ('owner', 'contributor', 'reader')", name="ck_vault_role"),
    )
    op.create_index("ix_vault_membership_user", "vault_memberships", ["user_id", "vault_id"])
    op.create_table(
        "vault_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("vault_id", sa.String(36), sa.ForeignKey("project_vaults.id"), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("target_id", sa.String(36), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_vault_events_vault_id", "vault_events", ["vault_id"])


def downgrade():
    op.drop_index("ix_vault_events_vault_id", table_name="vault_events")
    op.drop_table("vault_events")
    op.drop_index("ix_vault_membership_user", table_name="vault_memberships")
    op.drop_table("vault_memberships")
    op.drop_table("project_vaults")
