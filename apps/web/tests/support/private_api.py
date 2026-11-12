"""Isolated browser test application; never packaged/deployed as the real API."""

import os
import threading
import time

from campus_api.config import Settings
from campus_api.main import create_app
from campus_api.models import VaultDocument
from campus_api.scan_worker import process_event
from sqlalchemy.orm import Session
from tests.test_documents import TOPIC, MemoryStore, scan


def create_test_app():
    if os.getenv("RUN_CONNECTED_E2E") != "1":
        raise RuntimeError("Browser test application only")
    settings = Settings.from_env()
    if not settings.database_url.startswith("sqlite"):
        raise RuntimeError("Browser tests require isolated SQLite")
    app = create_app(settings)

    class BrowserStore(MemoryStore):
        def upload(self, key, data, media_type):
            ref = super().upload(key, data, media_type)
            vault_id, document_id = key.split("/")

            def analyze():
                for _ in range(50):
                    time.sleep(0.1)
                    with Session(app.state.engine) as db:
                        doc = db.get(VaultDocument, document_id)
                        ready = doc is not None and doc.status == "quarantined"
                    if ready:
                        verdict = (
                            "Malicious"
                            if b"blocked-test" in data
                            else "No threats found"
                        )
                        process_event(
                            app.state.engine,
                            self,
                            scan(self, vault_id, document_id, verdict),
                            TOPIC,
                        )
                        return

            threading.Thread(target=analyze, daemon=True).start()
            return ref

    app.state.document_store = BrowserStore()
    return app
