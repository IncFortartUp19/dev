"""Private, version-pinned Azure Blob access. No SAS or public URLs are returned."""

from dataclasses import dataclass
from hashlib import sha256

from azure.core import MatchConditions
from azure.core.exceptions import AzureError, ResourceExistsError
from azure.identity import ManagedIdentityCredential
from azure.storage.blob import BlobServiceClient, ContentSettings

MAX_BYTES = 10 * 1024 * 1024


class StorageFailure(Exception):
    pass


@dataclass(frozen=True)
class BlobRef:
    etag: str
    version: str

    def __post_init__(self):
        if any(
            not isinstance(value, str) or not value or len(value) > 100
            for value in (self.etag, self.version)
        ):
            raise StorageFailure("A pinned Blob version and ETag are required")


def reference(properties):
    etag, version = properties.get("etag"), properties.get("version_id")
    if (
        not isinstance(etag, str)
        or not isinstance(version, str)
        or not etag
        or not version
        or max(len(etag), len(version)) > 100
    ):
        raise StorageFailure("Versioned storage is required")
    return BlobRef(etag, version)


def checked_bytes(data: bytes, size: int, digest: str):
    if len(data) != size or len(data) > MAX_BYTES or sha256(data).hexdigest() != digest:
        raise StorageFailure("Content verification failed")
    return data


class AzureDocumentStore:
    def __init__(
        self, account_url, *, upload_client_id=None, reader_client_id=None, promotion_client_id=None
    ):
        self.account_url = account_url
        self.credentials = []
        self.clients = {}
        for purpose, client_id in (
            ("upload", upload_client_id),
            ("read", reader_client_id),
            ("promote", promotion_client_id),
        ):
            if client_id:
                credential = ManagedIdentityCredential(client_id=client_id)
                self.credentials.append(credential)
                self.clients[purpose] = BlobServiceClient(
                    account_url,
                    credential=credential,
                    retry_total=2,
                    connection_timeout=5,
                    read_timeout=20,
                )

    def close(self):
        for client in self.clients.values():
            client.close()
        for credential in self.credentials:
            credential.close()

    def upload(self, key, data, media_type):
        try:
            blob = self.clients["upload"].get_blob_client("quarantine", key)
            return reference(
                blob.upload_blob(
                    data,
                    overwrite=False,
                    content_settings=ContentSettings(content_type="application/octet-stream"),
                    validate_content=True,
                    timeout=20,
                )
            )
        except AzureError as exc:
            raise StorageFailure("Upload unavailable") from exc

    def _read(self, purpose, container, key, ref, size):
        if not 0 < size <= MAX_BYTES:
            raise StorageFailure("Invalid document size")
        try:
            blob = self.clients[purpose].get_blob_client(container, key, version_id=ref.version)
            stream = blob.download_blob(
                etag=ref.etag,
                match_condition=MatchConditions.IfNotModified,
                max_concurrency=1,
                timeout=20,
            )
            parts, total = [], 0
            for part in stream.chunks():
                total += len(part)
                if total > size:
                    raise StorageFailure("Unexpected document length")
                parts.append(part)
            if total != size:
                raise StorageFailure("Unexpected document length")
            return b"".join(parts)
        except AzureError as exc:
            raise StorageFailure("Document unavailable") from exc

    def read(self, key, ref, size):
        return self._read("read", "released", key, ref, size)

    def promote(self, key, ref, size, digest):
        data = checked_bytes(self._read("promote", "quarantine", key, ref, size), size, digest)
        blob = self.clients["promote"].get_blob_client("released", key)
        try:
            return reference(
                blob.upload_blob(
                    data,
                    overwrite=False,
                    content_settings=ContentSettings(content_type="application/octet-stream"),
                    validate_content=True,
                    timeout=20,
                )
            )
        except ResourceExistsError:
            # Retry after a DB failure: accept only a version with exactly the expected bytes.
            try:
                existing = reference(blob.get_blob_properties(timeout=20))
                checked_bytes(self._read("promote", "released", key, existing, size), size, digest)
                return existing
            except AzureError as exc:
                raise StorageFailure("Promotion unavailable") from exc
        except AzureError as exc:
            raise StorageFailure("Promotion unavailable") from exc
