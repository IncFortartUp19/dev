from hashlib import sha256
from unittest.mock import Mock

import pytest
from azure.core import MatchConditions
from azure.core.exceptions import ResourceExistsError

from campus_api.blob_store import AzureDocumentStore, BlobRef, StorageFailure


def test_missing_immutable_reference_never_falls_back_to_latest_blob():
    for values in (("etag", None), (None, "version"), ("etag", "")):
        with pytest.raises(StorageFailure):
            BlobRef(*values)


def test_azure_reads_are_version_and_etag_pinned_and_bounded():
    service, blob = Mock(), Mock()
    service.get_blob_client.return_value = blob
    blob.download_blob.return_value.chunks.return_value = [b"abc", b"def"]
    store = AzureDocumentStore.__new__(AzureDocumentStore)
    store.clients = {"read": service}
    ref = BlobRef('"0xabcdef"', "immutable-version")
    assert store.read("vault/document", ref, 6) == b"abcdef"
    service.get_blob_client.assert_called_once_with(
        "released", "vault/document", version_id="immutable-version"
    )
    assert blob.download_blob.call_args.kwargs["etag"] == ref.etag
    assert blob.download_blob.call_args.kwargs["match_condition"] == MatchConditions.IfNotModified
    blob.download_blob.return_value.chunks.return_value = [b"too much data"]
    with pytest.raises(StorageFailure):
        store.read("vault/document", ref, 6)


def test_promotion_retry_checks_existing_destination_bytes_instead_of_trusting_tags():
    service, destination = Mock(), Mock()
    service.get_blob_client.return_value = destination
    destination.upload_blob.side_effect = ResourceExistsError("already exists")
    destination.get_blob_properties.return_value = {"etag": '"dest"', "version_id": "dest-version"}
    store = AzureDocumentStore.__new__(AzureDocumentStore)
    store.clients = {"promote": service}
    store._read = Mock(side_effect=[b"abc", b"abc"])
    digest = sha256(b"abc").hexdigest()
    assert store.promote(
        "vault/document", BlobRef("source", "source-version"), 3, digest
    ) == BlobRef('"dest"', "dest-version")
    assert destination.upload_blob.call_args.kwargs["overwrite"] is False
    store._read = Mock(side_effect=[b"abc", b"xyz"])
    with pytest.raises(StorageFailure):
        store.promote("vault/document", BlobRef("source", "source-version"), 3, digest)
