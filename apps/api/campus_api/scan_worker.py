"""Trusted Service Bus consumer. This module exposes no HTTP scanner callback."""

import json
import os
import re
from dataclasses import dataclass
from hashlib import sha256
from urllib.parse import urlparse
from uuid import UUID

from azure.identity import ManagedIdentityCredential
from azure.servicebus import AutoLockRenewer, ServiceBusClient, TransportType
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from campus_api.blob_store import AzureDocumentStore, BlobRef, StorageFailure
from campus_api.config import Settings
from campus_api.database_security import verify_runtime_database
from campus_api.db import make_engine
from campus_api.models import ScanReceipt, VaultDocument


class InvalidScan(Exception):
    pass


class RetryScan(Exception):
    pass


def etag(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 100:
        raise InvalidScan("Missing ETag")
    normalized = value.strip('"')
    if not normalized:
        raise InvalidScan("Empty ETag")
    return normalized


@dataclass(frozen=True)
class ScanEvent:
    id: str
    vault_id: str
    document_id: str
    container: str
    etag: str
    clean: bool
    digest: str


def parse_event(raw: bytes, account_url: str, topic: str):
    if len(raw) > 65536:
        raise InvalidScan("Event too large")
    try:
        value = json.loads(raw)
        if isinstance(value, list):
            if len(value) != 1:
                raise ValueError("Single event required")
            value = value[0]
        if (
            value["eventType"] != "Microsoft.Security.MalwareScanningResult"
            or value["topic"].lower() != topic.lower()
            or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", value["id"])
        ):
            raise ValueError("Untrusted event envelope")
        data = value["data"]
        url = urlparse(data["blobUri"])
        if f"{url.scheme}://{url.netloc}" != account_url or url.query or url.fragment:
            raise ValueError("Unexpected storage account")
        parts = url.path.split("/")
        if len(parts) != 4 or parts[1] not in ("quarantine", "released"):
            raise ValueError("Unexpected blob path")
        vault_id, document_id = str(UUID(parts[2])), str(UUID(parts[3]))
        if [vault_id, document_id] != parts[2:]:
            raise ValueError("Noncanonical blob path")
        verdict = data["scanResultType"]
        if verdict not in ("No threats found", "Malicious", "Error", "Not scanned"):
            raise ValueError("Unknown verdict")
        digest = sha256(
            json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        return ScanEvent(
            value["id"],
            vault_id,
            document_id,
            parts[1],
            etag(data["eTag"]),
            verdict == "No threats found",
            digest,
        )
    except (ValueError, KeyError, TypeError, AttributeError, UnicodeDecodeError) as exc:
        raise InvalidScan("Invalid scan event") from exc


def process_event(engine, store, raw: bytes, topic: str):
    event = parse_event(raw, store.account_url, topic)
    with Session(engine, expire_on_commit=False) as db:
        doc = db.scalar(
            select(VaultDocument)
            .where(VaultDocument.id == event.document_id, VaultDocument.vault_id == event.vault_id)
            .with_for_update()
        )
        if doc is None:
            raise InvalidScan("Unknown document")
        if doc.status == "uploading":
            raise RetryScan("Upload metadata not committed yet")
        expected_etag = doc.source_etag if event.container == "quarantine" else doc.released_etag
        if event.container == "released" and not expected_etag:
            raise RetryScan("Promotion metadata not committed yet")
        if etag(expected_etag) != event.etag:
            raise InvalidScan("Source ETag mismatch")
        previous = db.get(ScanReceipt, event.id)
        if previous:
            if previous.event_sha256 != event.digest or previous.document_id != doc.id:
                raise InvalidScan("Conflicting event ID")
            return "duplicate"
        outcome = "ignored"
        if not event.clean and doc.status in ("quarantined", "released", "blocked"):
            doc.status, outcome = "blocked", "blocked"
        elif event.clean and event.container == "quarantine" and doc.status == "quarantined":
            ref = store.promote(
                f"{doc.vault_id}/{doc.id}",
                BlobRef(doc.source_etag, doc.source_version),
                doc.size,
                doc.sha256,
            )
            doc.released_etag, doc.released_version, doc.status = ref.etag, ref.version, "released"
            outcome = "released"
        db.add(
            ScanReceipt(
                id=event.id,
                document_id=doc.id,
                vault_id=doc.vault_id,
                event_sha256=event.digest,
                outcome=outcome,
            )
        )
        db.commit()
        return outcome


def message_payload(message):
    raw = bytearray()
    try:
        for part in message.body:
            if not isinstance(part, (bytes, bytearray)) or len(raw) + len(part) > 65536:
                raise InvalidScan("Invalid queue body")
            raw.extend(part)
    except TypeError as exc:
        raise InvalidScan("Invalid queue body") from exc
    return bytes(raw)


def main():
    # Queue send rights belong only to the trusted Event Grid delivery identity.
    # The worker login has incfs_scanner; the web/API login must never have it.
    database_url = os.environ["SCANNER_DATABASE_URL"]
    account_url = os.environ["BLOB_ACCOUNT_URL"]
    namespace = os.environ["SCANNER_SERVICE_BUS_NAMESPACE"]
    queue = os.environ["SCANNER_SERVICE_BUS_QUEUE"]
    client_id = str(UUID(os.environ["SCANNER_CLIENT_ID"]))
    topic = os.environ["SCANNER_EVENT_GRID_TOPIC_ID"]
    if (
        not database_url.startswith("postgresql")
        or not re.fullmatch(r"https://[a-z0-9]{3,24}\.blob\.core\.windows\.net", account_url)
        or not re.fullmatch(r"[a-z0-9-]+\.servicebus\.windows\.net", namespace)
        or not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", queue)
        or not re.fullmatch(
            r"/subscriptions/[0-9a-fA-F-]{36}/resourceGroups/[^/]+/providers/Microsoft.EventGrid/topics/[^/]+",
            topic,
        )
    ):
        raise ValueError("Invalid scanner service configuration")
    engine = make_engine(Settings(database_url=database_url))
    verify_runtime_database(engine, scanner=True)
    store = AzureDocumentStore(account_url, promotion_client_id=client_id)
    try:
        with (
            ManagedIdentityCredential(client_id=client_id) as credential,
            ServiceBusClient(
                namespace, credential, transport_type=TransportType.AmqpOverWebsocket
            ) as client,
            AutoLockRenewer(max_lock_renewal_duration=300) as renewer,
            client.get_queue_receiver(
                queue_name=queue, auto_lock_renewer=renewer, max_wait_time=10
            ) as receiver,
        ):
            while True:
                for message in receiver.receive_messages(max_message_count=1, max_wait_time=10):
                    try:
                        process_event(engine, store, message_payload(message), topic)
                    except InvalidScan:
                        receiver.dead_letter_message(message, reason="InvalidScanEvent")
                    except (RetryScan, StorageFailure, SQLAlchemyError):
                        receiver.abandon_message(message)
                    else:
                        receiver.complete_message(message)
    finally:
        store.close()
        engine.dispose()


if __name__ == "__main__":
    main()
