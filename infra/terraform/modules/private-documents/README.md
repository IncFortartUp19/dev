# Private document storage foundation

Standalone module, not wired into dev and not deployed. See [security design and remaining gates](../../../../docs/product/rls-and-document-storage.md).

Inputs require an existing private-endpoint subnet, a Blob private DNS zone linked to the application VNet, a custom Event Grid topic for scan results, and three distinct managed-identity principal IDs. Configure the parent AzureRM provider for Azure AD storage auth; container creation uses resource-manager IDs. No access keys or SAS are output.

Creates private quarantine/released containers, a Blob private endpoint, versioning/soft-delete, container-scoped service RBAC and Defender malware-on-upload configuration. Upload/reader/promotion identities must be different. The module has no document API, scan-result consumer or automatic promotion. Do not connect user uploads until those controls and real network/scanner tests pass.

```bash
terraform init -backend=false -lockfile=readonly
terraform validate
terraform test
```

Tests use mocked Azure resources, including simulated apply; they do not deploy. Defender scans, Storage, networking and Event Grid incur charges when deployed. The scan cap does not cap all costs, and unscanned blobs must remain inaccessible. LRS is the initial configuration; cross-region recovery is not configured.
