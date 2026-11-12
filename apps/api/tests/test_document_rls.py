from dataclasses import replace
from secrets import token_hex
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from campus_api.database_security import verify_runtime_database
from campus_api.db import bind_actor, make_engine
from campus_api.scan_worker import process_event
from tests.test_documents import TOPIC, MemoryStore, scan, upload
from tests.test_rls import create


def test_document_policies_separate_user_runtime_and_scanner_login(protected_api):
    api, engine, admin = protected_api
    with admin.begin() as conn:
        role = conn.scalar(text("SELECT current_user"))
        assert role
        # Get the actual API login; grants deliberately broader than production.
        with engine.connect() as runtime:
            api_role = runtime.scalar(text("SELECT current_user"))
        conn.execute(text(f"GRANT incfs_documents_api TO {api_role} WITH INHERIT TRUE"))
        conn.execute(
            text(
                "GRANT SELECT, INSERT, UPDATE, DELETE ON vault_documents, "
                f"document_scan_receipts TO {api_role}"
            )
        )
    store = MemoryStore()
    api.app.state.document_store = store
    verify_runtime_database(engine, documents=True)
    with admin.begin() as conn:
        conn.execute(text(f"GRANT incfs_documents_api TO {api_role} WITH INHERIT FALSE"))
    with pytest.raises(RuntimeError):
        verify_runtime_database(engine, documents=True)
    with admin.begin() as conn:
        conn.execute(text(f"GRANT incfs_documents_api TO {api_role} WITH INHERIT TRUE"))
    a, alice = create(api, "alice")
    b, bob = create(api, "bob")
    response = upload(api, a, "alice")
    assert response.status_code == 201, response.text
    document = response.json()["id"]
    with Session(engine) as db:
        bind_actor(db, bob)
        assert db.execute(text("SELECT * FROM vault_documents")).all() == []
        db.rollback()
        bind_actor(db, alice)
        assert db.scalars(text("SELECT id FROM vault_documents")).all() == [document]
        assert (
            db.execute(
                text(
                    "UPDATE vault_documents SET status='released', released_etag='forged', "
                    "released_version='forged'"
                )
            ).rowcount
            == 0
        )
        assert db.execute(text("SELECT * FROM document_scan_receipts")).all() == []
        db.rollback()
        with pytest.raises(DBAPIError):
            db.execute(text("SET LOCAL ROLE incfs_scanner"))
        db.rollback()
    assert (
        api.request(
            "POST", f"/vaults/{a}/members", "alice", json={"user_id": bob, "role": "contributor"}
        ).status_code
        == 201
    )
    assert upload(api, a, "bob").status_code == 201
    scanner_role, password = "scan_test_" + uuid4().hex, token_hex(24)
    with admin.begin() as conn:
        conn.execute(
            text(f"CREATE ROLE {scanner_role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '{password}'")
        )
        conn.execute(text(f"GRANT incfs_scanner TO {scanner_role} WITH INHERIT TRUE"))
    url = make_url(api.settings.prepare_database_url()).set(
        username=scanner_role, password=password
    )
    scanner = make_engine(
        replace(api.settings, database_url=url.render_as_string(hide_password=False))
    )
    try:
        verify_runtime_database(scanner, scanner=True)
        with pytest.raises(RuntimeError):
            verify_runtime_database(scanner)
        with pytest.raises(RuntimeError):
            verify_runtime_database(engine, scanner=True)
        assert process_event(scanner, store, scan(store, a, document), TOPIC) == "released"
        path = f"/vaults/{a}/documents/{document}/content"
        assert api.request("GET", path, "alice").content == b"Private project notes"
        assert api.request("GET", path, "bob").status_code == 200
        assert api.request("DELETE", f"/vaults/{a}/members/{bob}", "alice").status_code == 204
        assert api.request("GET", path, "bob").status_code == 404
        assert (
            process_event(scanner, store, scan(store, a, document, "Malicious"), TOPIC) == "blocked"
        )
        assert process_event(scanner, store, scan(store, a, document), TOPIC) == "ignored"
        assert (
            api.request("GET", f"/vaults/{a}/documents/{document}/content", "alice").status_code
            == 423
        )
        with scanner.begin() as conn:
            with pytest.raises(DBAPIError):
                conn.execute(text("SELECT * FROM users"))
        with Session(engine) as db:
            bind_actor(db, alice)
            assert db.execute(text("SELECT * FROM document_scan_receipts")).all() == []
    finally:
        scanner.dispose()
        with admin.begin() as conn:
            conn.execute(text(f"DROP OWNED BY {scanner_role}"))
            conn.execute(text(f"DROP ROLE {scanner_role}"))
