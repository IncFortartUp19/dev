import json
from hashlib import sha256
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from campus_api.blob_store import BlobRef, StorageFailure, checked_bytes
from campus_api.models import ScanReceipt, VaultDocument
from campus_api.scan_worker import InvalidScan, RetryScan, message_payload, process_event
from tests.test_vaults import vault

TOPIC = (
    "/subscriptions/00000000-0000-0000-0000-000000000000/"
    "resourceGroups/test/providers/Microsoft.EventGrid/topics/scans"
)


class MemoryStore:
    """Explicit test double. The application has no memory/local-storage fallback."""

    account_url = "https://incfstest.blob.core.windows.net"

    def __init__(self):
        self.quarantine, self.released = {}, {}
        self.reads, self.promotions = 0, 0
        self.fail_upload = False

    def close(self):
        pass

    def upload(self, key, data, media_type):
        if self.fail_upload:
            raise StorageFailure()
        assert key not in self.quarantine
        ref = BlobRef('"0x' + sha256(data).hexdigest()[:16] + '"', str(uuid4()))
        self.quarantine[key] = (data, ref)
        return ref

    def promote(self, key, ref, size, digest):
        data, actual = self.quarantine[key]
        if actual != ref:
            raise StorageFailure()
        checked_bytes(data, size, digest)
        self.promotions += 1
        if key not in self.released:
            self.released[key] = (data, BlobRef(ref.etag, str(uuid4())))
        return self.released[key][1]

    def read(self, key, ref, size):
        self.reads += 1
        data, actual = self.released[key]
        if actual != ref:
            raise StorageFailure()
        return data


def upload(
    api,
    project,
    actor="founder",
    content=b"Private project notes",
    filename="notes.txt",
    media_type="text/plain",
):
    return api.client.post(
        f"/v1/vaults/{project}/documents",
        headers={
            "Authorization": f"Bearer test-{actor}",
            "Content-Type": media_type,
            "X-File-Name": filename,
        },
        content=content,
    )


def scan(store, project, document, verdict="No threats found", event_id=None, **data_changes):
    ref = store.quarantine[f"{project}/{document}"][1]
    return json.dumps(
        {
            "id": event_id or str(uuid4()),
            "topic": TOPIC,
            "eventType": "Microsoft.Security.MalwareScanningResult",
            "data": {
                "blobUri": f"{store.account_url}/quarantine/{project}/{document}",
                "eTag": ref.etag.strip('"'),
                "scanResultType": verdict,
                **data_changes,
            },
        }
    ).encode()


@pytest.fixture
def docs(api):
    store = MemoryStore()
    api.app.state.document_store = store
    return api, store


def test_quarantine_release_download_revocation_and_late_malware(docs):
    api, store = docs
    project = vault(api)
    other = vault(api, "other")
    reader = api.request("GET", "/me", "reader").json()["id"]
    assert (
        api.request(
            "POST",
            f"/vaults/{project}/members",
            "founder",
            json={"user_id": reader, "role": "reader"},
        ).status_code
        == 201
    )
    response = upload(api, project)
    assert response.status_code == 201, response.text
    document = response.json()["id"]
    assert response.json()["status"] == "quarantined"
    assert not {"sha256", "source_version", "source_etag", "released_version"}.intersection(
        response.json()
    )
    path = f"/vaults/{project}/documents/{document}/content"
    assert api.request("GET", path, "reader").status_code == 423
    assert store.reads == 0
    assert api.request("GET", path, "other").status_code == 404
    assert (
        api.request("GET", f"/vaults/{other}/documents/{document}/content", "other").status_code
        == 404
    )
    assert upload(api, project, "reader").status_code == 403
    clean = scan(store, project, document)
    assert process_event(api.app.state.engine, store, clean, TOPIC) == "released"
    assert process_event(api.app.state.engine, store, clean, TOPIC) == "duplicate"
    assert store.promotions == 1
    downloaded = api.request("GET", path, "reader")
    assert downloaded.status_code == 200
    assert downloaded.content == b"Private project notes"
    assert downloaded.headers["cache-control"] == "no-store"
    assert downloaded.headers["content-type"] == "application/octet-stream"
    assert downloaded.headers["content-disposition"].startswith("attachment;")
    assert (
        api.request("DELETE", f"/vaults/{project}/members/{reader}", "founder").status_code == 204
    )
    assert api.request("GET", path, "reader").status_code == 404
    assert (
        process_event(
            api.app.state.engine, store, scan(store, project, document, "Malicious"), TOPIC
        )
        == "blocked"
    )
    assert (
        process_event(api.app.state.engine, store, scan(store, project, document), TOPIC)
        == "ignored"
    )
    assert api.request("GET", path, "founder").status_code == 423
    assert store.promotions == 1
    with Session(api.app.state.engine) as db:
        assert len(db.scalars(select(ScanReceipt)).all()) == 3


@pytest.mark.parametrize("verdict", ["Malicious", "Error", "Not scanned"])
def test_non_clean_results_never_promote(docs, verdict):
    api, store = docs
    project = vault(api)
    document = upload(api, project).json()["id"]
    assert (
        process_event(api.app.state.engine, store, scan(store, project, document, verdict), TOPIC)
        == "blocked"
    )
    assert store.promotions == store.reads == 0
    assert (
        api.request("GET", f"/vaults/{project}/documents/{document}/content", "founder").status_code
        == 423
    )


@pytest.mark.parametrize(
    "change", ["topic", "type", "etag", "account", "path", "query", "verdict", "missing", "large"]
)
def test_forged_or_mismatched_scan_results_leave_quarantine_closed(docs, change):
    api, store = docs
    project = vault(api)
    document = upload(api, project).json()["id"]
    value = json.loads(scan(store, project, document))
    if change == "topic":
        value["topic"] += "-attacker"
    if change == "type":
        value["eventType"] = "user.upload.complete"
    if change == "etag":
        value["data"]["eTag"] = "other-version"
    if change == "account":
        value["data"]["blobUri"] = value["data"]["blobUri"].replace("incfstest", "otheraccount")
    if change == "path":
        value["data"]["blobUri"] = value["data"]["blobUri"].replace(
            "quarantine", "untrusted-container"
        )
    if change == "query":
        value["data"]["blobUri"] += "?sig=untrusted"
    if change == "verdict":
        value["data"]["scanResultType"] = "clean"
    if change == "missing":
        del value["data"]["eTag"]
    raw = b" " * 65537 if change == "large" else json.dumps(value).encode()
    with pytest.raises(InvalidScan):
        process_event(api.app.state.engine, store, raw, TOPIC)
    assert store.promotions == 0
    assert (
        api.request("GET", f"/vaults/{project}/documents/{document}/content", "founder").status_code
        == 423
    )


def test_content_checks_and_conflicting_event_ids_cannot_release_altered_content(docs):
    api, store = docs
    project = vault(api)
    document = upload(api, project).json()["id"]
    key = f"{project}/{document}"
    clean = scan(store, project, document, event_id="fixed-id")
    original = store.quarantine[key]
    store.quarantine[key] = (b"altered data", original[1])
    with pytest.raises(StorageFailure):
        process_event(api.app.state.engine, store, clean, TOPIC)
    store.quarantine[key] = original
    assert process_event(api.app.state.engine, store, clean, TOPIC) == "released"
    with pytest.raises(InvalidScan):
        process_event(
            api.app.state.engine,
            store,
            scan(store, project, document, "Malicious", event_id="fixed-id"),
            TOPIC,
        )
    store.released[key] = (b"altered data", store.released[key][1])
    response = api.request("GET", f"/vaults/{project}/documents/{document}/content", "founder")
    assert response.status_code == 502 and b"altered data" not in response.content


def test_scanner_retries_early_events_and_failed_uploads_stay_inaccessible(docs):
    api, store = docs
    project = vault(api)
    document = upload(api, project).json()["id"]
    with Session(api.app.state.engine) as db:
        db.get(VaultDocument, document).status = "uploading"
        db.commit()
    with pytest.raises(RetryScan):
        process_event(api.app.state.engine, store, scan(store, project, document), TOPIC)
    store.fail_upload = True
    assert upload(api, project).status_code == 502
    listed = api.request("GET", f"/vaults/{project}/documents", "founder").json()
    assert {item["status"] for item in listed} == {"uploading", "failed"}


@pytest.mark.parametrize(
    "data,name,media,status",
    [
        (b"", "x.txt", "text/plain", 422),
        (b"test", "../x.txt", "text/plain", 422),
        (b"test", "x.html", "text/html", 415),
        (b"not pdf", "x.pdf", "application/pdf", 415),
        (b"\x00", "x.txt", "text/plain", 415),
        (b"x" * (10485760 + 1), "x.txt", "text/plain", 413),
    ],
)
def test_upload_validation(docs, data, name, media, status):
    api, store = docs
    assert (
        upload(api, vault(api), content=data, filename=name, media_type=media).status_code == status
    )
    assert not store.quarantine


def test_documents_disabled_by_default_and_no_scanner_http_callback(api):
    project = vault(api)
    assert upload(api, project).status_code == 503
    assert (
        api.request("POST", "/scanner/results", "founder", json={"status": "clean"}).status_code
        == 404
    )


def test_queue_payload_rejects_non_data_messages_and_large_events():
    from types import SimpleNamespace

    assert message_payload(SimpleNamespace(body=[b"a", b"b"])) == b"ab"
    for body in ("untrusted string", [b"x" * 65537], None):
        with pytest.raises(InvalidScan):
            message_payload(SimpleNamespace(body=body))


def test_utf8_filename_is_decoded_and_encoded_controls_are_rejected(docs):
    api, store = docs
    project = vault(api)
    response = upload(api, project, filename="caf%C3%A8.txt")
    assert response.status_code == 201 and response.json()["filename"] == "cafè.txt"
    assert upload(api, project, filename="x%0d%0a.txt").status_code == 422
    assert upload(api, project, filename="x%FF.txt").status_code == 422


def test_destination_scan_never_causes_release_and_can_block_existing_release(docs):
    api, store = docs
    project = vault(api)
    document = upload(api, project).json()["id"]
    dest_uri = f"{store.account_url}/released/{project}/{document}"
    destination = scan(store, project, document, blobUri=dest_uri)
    with pytest.raises(RetryScan):
        process_event(api.app.state.engine, store, destination, TOPIC)
    assert store.promotions == 0
    assert (
        process_event(api.app.state.engine, store, scan(store, project, document), TOPIC)
        == "released"
    )
    ref = store.released[f"{project}/{document}"][1]
    assert (
        process_event(
            api.app.state.engine,
            store,
            scan(store, project, document, blobUri=dest_uri, eTag=ref.etag),
            TOPIC,
        )
        == "ignored"
    )
    assert (
        process_event(
            api.app.state.engine,
            store,
            scan(store, project, document, "Malicious", blobUri=dest_uri, eTag=ref.etag),
            TOPIC,
        )
        == "blocked"
    )
    assert (
        api.request("GET", f"/vaults/{project}/documents/{document}/content", "founder").status_code
        == 423
    )
