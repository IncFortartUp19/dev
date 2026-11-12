# Private document storage foundation

Standalone module, not wired into dev and not deployed. See [security design and remaining gates](../../../../docs/product/rls-and-document-storage.md).

Inputs require an existing private-endpoint subnet, a Blob private DNS zone linked to the application VNet, a custom Event Grid topic for scan results, an existing Service Bus namespace, three distinct workload managed identities, and the system-assigned principal ID of the Event Grid topic. Configure the parent AzureRM provider for Azure AD storage auth; container creation uses resource-manager IDs. No access keys or SAS are output.

Creates private quarantine/released containers, a Blob private endpoint, versioning/soft-delete, container-scoped service RBAC and Defender malware-on-upload configuration. Upload/reader/promotion/Event Grid delivery principals must be different. The module adds a Service Bus scan queue and an Event Grid subscription using system-assigned identity, queue-scoped sender/receiver RBAC, retries and dead-lettering. The consumer and document API are in `apps/api`; see [the pipeline](../../../../docs/product/private-document-pipeline.md). Do not enable user uploads before real network/scanner tests pass.

The existing Event Grid custom topic must have system-assigned identity and support public IP ingress for Defender scan results. Its system principal is scan_delivery_principal_id. Service Bus must allow the documented trusted Microsoft service bypass, disable local auth and provide private worker connectivity. Event Grid basic cannot deliver end-to-end over Private Link; the system-assigned identity is required for firewall-restricted destinations. Restrict topic publishers and validate these existing-resource settings before deployment.

```bash
terraform init -backend=false -lockfile=readonly
terraform validate
terraform test
```

Tests use mocked Azure resources, including simulated apply; they do not deploy. Defender scans, Storage, networking and Event Grid incur charges when deployed. The scan cap does not cap all costs, and unscanned blobs must remain inaccessible. LRS is the initial configuration; cross-region recovery is not configured.
