"""Version-bound quarantined documents and isolated scanner role.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None
ACTOR = "NULLIF(current_setting('app.actor_id', true), '')"


def upgrade():
    op.create_table(
        "vault_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("vault_id", sa.String(36), sa.ForeignKey("project_vaults.id"), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename", sa.String(180), nullable=False),
        sa.Column("media_type", sa.String(40), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("source_etag", sa.String(100)),
        sa.Column("source_version", sa.String(100)),
        sa.Column("released_etag", sa.String(100)),
        sa.Column("released_version", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["vault_id", "owner_id"],
            ["project_vaults.id", "project_vaults.created_by"],
            name="fk_document_vault_owner",
        ),
        sa.CheckConstraint(
            "status IN ('uploading', 'quarantined', 'released', 'blocked', 'failed')",
            name="ck_document_status",
        ),
        sa.CheckConstraint("size > 0 AND size <= 10485760", name="ck_document_size"),
        sa.CheckConstraint(
            "status NOT IN ('quarantined','released') OR "
            "(source_etag IS NOT NULL AND source_version IS NOT NULL "
            "AND source_etag <> '' AND source_version <> '')",
            name="ck_document_source_version",
        ),
        sa.CheckConstraint(
            "status <> 'released' OR (released_etag IS NOT NULL AND released_version IS NOT NULL)",
            name="ck_document_released_version",
        ),
    )
    op.create_index("ix_vault_documents_vault_id", "vault_documents", ["vault_id"])
    op.create_index("uq_document_vault", "vault_documents", ["id", "vault_id"], unique=True)
    op.create_table(
        "document_scan_receipts",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("document_id", sa.String(36), nullable=False),
        sa.Column("vault_id", sa.String(36), nullable=False),
        sa.Column("event_sha256", sa.String(64), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id", "vault_id"],
            ["vault_documents.id", "vault_documents.vault_id"],
            name="fk_receipt_document_vault",
        ),
    )
    op.create_index("ix_document_scan_receipts_vault_id", "document_scan_receipts", ["vault_id"])
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(
        sa.text("""
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='incfs_scanner') THEN
          CREATE ROLE incfs_scanner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='incfs_scanner'
          AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolcanlogin)) THEN
          RAISE EXCEPTION 'Unsafe incfs_scanner role';
        END IF;
      END $$
    """)
    )
    for table in ("vault_documents", "document_scan_receipts"):
        op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
    op.execute(
        sa.text("""
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='incfs_documents_api') THEN
          CREATE ROLE incfs_documents_api NOLOGIN NOSUPERUSER NOCREATEDB
            NOCREATEROLE NOBYPASSRLS;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='incfs_documents_api'
          AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolcanlogin)) THEN
          RAISE EXCEPTION 'Unsafe incfs_documents_api role';
        END IF;
      END $$
    """)
    )
    op.execute(sa.text("GRANT USAGE ON SCHEMA public TO incfs_documents_api"))
    op.execute(sa.text("GRANT SELECT, INSERT ON vault_documents TO incfs_documents_api"))
    op.execute(
        sa.text(
            "GRANT UPDATE (status, source_etag, source_version) "
            "ON vault_documents TO incfs_documents_api"
        )
    )
    access = (
        f"EXISTS (SELECT 1 FROM vault_memberships m WHERE "
        f"m.vault_id=vault_documents.vault_id AND m.user_id={ACTOR})"
    )
    writer = (
        f"EXISTS (SELECT 1 FROM vault_memberships m WHERE "
        f"m.vault_id=vault_documents.vault_id AND m.user_id={ACTOR} AND m.role IN "
        f"('owner','contributor'))"
    )
    op.execute(
        sa.text(
            f"CREATE POLICY documents_read ON vault_documents FOR SELECT "
            f"TO incfs_documents_api USING ({access})"
        )
    )
    op.execute(
        sa.text(
            f"CREATE POLICY documents_create ON vault_documents FOR INSERT "
            f"TO incfs_documents_api WITH "
            f"CHECK ({writer} AND uploaded_by={ACTOR} AND status='uploading' AND "
            f"source_etag IS NULL AND source_version IS NULL AND released_etag "
            f"IS NULL AND released_version IS NULL)"
        )
    )
    op.execute(
        sa.text(
            f"CREATE POLICY documents_upload ON vault_documents FOR UPDATE "
            f"TO incfs_documents_api USING "
            f"({writer} AND uploaded_by={ACTOR} AND status='uploading') WITH "
            f"CHECK ({writer} AND uploaded_by={ACTOR} AND status IN "
            f"('quarantined','failed') AND released_etag IS NULL AND "
            f"released_version IS NULL)"
        )
    )
    op.execute(
        sa.text(
            "CREATE POLICY scanner_read ON vault_documents FOR SELECT TO incfs_scanner USING (true)"
        )
    )
    op.execute(
        sa.text(
            "CREATE POLICY scanner_update ON vault_documents FOR UPDATE TO "
            "incfs_scanner USING (status IN "
            "('quarantined','released','blocked')) WITH CHECK (status IN "
            "('released','blocked'))"
        )
    )
    op.execute(
        sa.text(
            "CREATE POLICY receipt_read ON document_scan_receipts FOR SELECT TO "
            "incfs_scanner USING (true)"
        )
    )
    op.execute(
        sa.text(
            "CREATE POLICY receipt_create ON document_scan_receipts FOR INSERT "
            "TO incfs_scanner WITH CHECK (true)"
        )
    )
    op.execute(sa.text("GRANT USAGE ON SCHEMA public TO incfs_scanner"))
    op.execute(sa.text("GRANT SELECT ON vault_documents, document_scan_receipts TO incfs_scanner"))
    op.execute(
        sa.text(
            "GRANT UPDATE (status, released_etag, released_version) ON "
            "vault_documents TO incfs_scanner"
        )
    )
    op.execute(sa.text("GRANT INSERT ON document_scan_receipts TO incfs_scanner"))
    op.execute(sa.text("DROP POLICY vault_events_create ON vault_events"))
    op.execute(
        sa.text(
            f"CREATE POLICY vault_events_create ON vault_events FOR INSERT WITH "
            f"CHECK (actor_id={ACTOR} AND (owner_id={ACTOR} OR (action IN "
            f"('document.uploaded','document.downloaded') AND EXISTS (SELECT 1 "
            f"FROM vault_memberships m WHERE m.vault_id=vault_events.vault_id "
            f"AND m.user_id={ACTOR}))))"
        )
    )


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text("DROP POLICY vault_events_create ON vault_events"))
        op.execute(
            sa.text(
                f"CREATE POLICY vault_events_create ON vault_events FOR INSERT "
                f"WITH CHECK (owner_id={ACTOR} AND actor_id={ACTOR})"
            )
        )
    op.drop_table("document_scan_receipts")
    op.drop_table("vault_documents")
    # Keep the NOLOGIN cluster role: it may have an explicitly provisioned worker login.
