"""Owner-only initial idea drafts with forced PostgreSQL row-level security.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "idea_drafts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("question", sa.String(2000), nullable=False),
        sa.Column("intention", sa.String(3000), nullable=False),
        sa.Column("next_test", sa.String(3000), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("visibility", sa.String(12), nullable=False, server_default="private"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("visibility = 'private'", name="ck_idea_drafts_private"),
        sa.CheckConstraint("length(trim(question)) > 0", name="ck_idea_drafts_question"),
    )
    op.create_index("ix_idea_drafts_owner_updated", "idea_drafts", ["owner_id", "updated_at"])
    if op.get_bind().dialect.name == "postgresql":
        actor = "NULLIF(current_setting('app.actor_id', true), '')"
        op.execute(sa.text("ALTER TABLE idea_drafts ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text("ALTER TABLE idea_drafts FORCE ROW LEVEL SECURITY"))
        op.execute(
            sa.text(
                f"CREATE POLICY idea_drafts_select ON idea_drafts FOR SELECT "
                f"USING (owner_id = {actor})"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY idea_drafts_insert ON idea_drafts FOR INSERT "
                f"WITH CHECK (owner_id = {actor} AND visibility = 'private')"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY idea_drafts_update ON idea_drafts FOR UPDATE "
                f"USING (owner_id = {actor}) "
                f"WITH CHECK (owner_id = {actor} AND visibility = 'private')"
            )
        )
        op.execute(
            sa.text("""DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'incfs_api') THEN
                GRANT SELECT, INSERT, UPDATE ON idea_drafts TO incfs_api;
            END IF;
        END $$""")
        )


def downgrade():
    op.drop_index("ix_idea_drafts_owner_updated", table_name="idea_drafts")
    op.drop_table("idea_drafts")
