"""Deployment guard: the runtime identity must not be able to bypass vault RLS."""

from sqlalchemy import text


def verify_runtime_database(engine, *, scanner=False, documents=False):
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Private production projects require PostgreSQL RLS")
    with engine.connect() as connection:
        privileged = connection.scalar(
            text("""
            SELECT EXISTS (
              SELECT 1 FROM pg_roles
              WHERE (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)
              AND (pg_has_role(current_user, oid, 'MEMBER')
                   OR pg_has_role(session_user, oid, 'MEMBER'))
            )
        """)
        )
        rows = connection.execute(
            text("""
            SELECT c.relrowsecurity, c.relforcerowsecurity,
                   (pg_has_role(current_user, c.relowner, 'MEMBER')
                    OR pg_has_role(session_user, c.relowner, 'MEMBER')) AS owns
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN ('project_vaults', 'vault_memberships', 'vault_events',
                                'vault_documents', 'document_scan_receipts', 'idea_drafts')
        """)
        ).all()
        can_create = connection.scalar(
            text(
                "SELECT has_schema_privilege(current_user, 'public', 'CREATE') "
                "OR has_schema_privilege(session_user, 'public', 'CREATE')"
            )
        )
        scanner_member = connection.scalar(
            text(
                "SELECT COALESCE((SELECT pg_has_role(current_user, oid, "
                "'MEMBER') OR pg_has_role(session_user, oid, 'MEMBER') FROM "
                "pg_roles WHERE rolname='incfs_scanner'), false)"
            )
        )
        api_member = connection.scalar(
            text("""
            SELECT COALESCE((SELECT pg_has_role(current_user, oid, 'MEMBER')
                OR pg_has_role(session_user, oid, 'MEMBER') FROM pg_roles
                WHERE rolname='incfs_documents_api'), false)
        """)
        )
        active_role = "incfs_scanner" if scanner else "incfs_documents_api"
        active = connection.scalar(
            text(
                "SELECT COALESCE((SELECT pg_has_role(current_user, oid, 'USAGE') "
                "FROM pg_roles WHERE rolname=:role), false)"
            ),
            {"role": active_role},
        )
        if (
            privileged
            or can_create
            or bool(scanner_member) != scanner
            or (scanner and api_member)
            or (documents and not api_member)
            or ((scanner or documents) and not active)
            or len(rows) != 6
            or any(not r.relrowsecurity or not r.relforcerowsecurity or r.owns for r in rows)
        ):
            raise RuntimeError("Unsafe database role or missing forced vault RLS")
