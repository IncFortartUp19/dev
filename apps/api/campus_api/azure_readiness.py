"""Read-only management-plane preflight; never claims a live malware/MFA test passed."""

import json
import os
import subprocess
from pathlib import Path

SUBSCRIPTION = "e299e7e6-628f-415a-955e-b77daea335a8"
TENANT = "935a6172-dc5e-4934-80b5-573139011df9"
GROUP = "rg-incforstartup-dev"


def az_json(*args):
    try:
        result = subprocess.run(
            ["az", *args, "--output", "json"], capture_output=True, text=True, timeout=60
        )
    except (subprocess.TimeoutExpired, OSError):
        return None
    if result.returncode:
        # Never publish raw Graph policy/user lists, credentials, or CLI diagnostics.
        return None
    try:
        return json.loads(result.stdout)
    except ValueError:
        return None


def check(name, passed, reason):
    return {
        "name": name,
        "status": "pass" if passed else "blocked",
        "reason": "checked" if passed else reason,
    }


def policy_requires_mfa(policy, context):
    conditions = policy.get("conditions") or {}
    users = conditions.get("users") or {}
    grants = policy.get("grantControls") or {}
    controls = grants.get("builtInControls") or []
    extra_conditions = any(
        value
        for key, value in conditions.items()
        if key not in ("users", "applications", "clientAppTypes")
    )
    return (
        policy.get("state") == "enabled"
        and not extra_conditions
        and conditions.get("clientAppTypes") == ["all"]
        and not (conditions.get("applications") or {}).get("excludeApplications")
        and context
        in (conditions.get("applications") or {}).get(
            "includeAuthenticationContextClassReferences", []
        )
        and users.get("includeUsers") == ["All"]
        and not any(
            users.get(key)
            for key in (
                "excludeUsers",
                "excludeGroups",
                "excludeRoles",
                "excludeGuestsOrExternalUsers",
            )
        )
        and "mfa" in controls
        and (
            grants.get("operator") == "AND"
            or controls == ["mfa"]
            and not grants.get("termsOfUse")
            and not grants.get("customAuthenticationFactors")
            and not grants.get("authenticationStrength")
        )
    )


def properties(resource_id, version):
    if not resource_id or not resource_id.lower().startswith(
        f"/subscriptions/{SUBSCRIPTION}/resourcegroups/{GROUP}/".lower()
    ):
        return None
    return az_json(
        "rest",
        "--method",
        "get",
        "--url",
        f"https://management.azure.com{resource_id}?api-version={version}",
    )


def main():
    account = az_json("account", "show") or {}
    checks = [
        check(
            "subscription_and_tenant",
            account.get("id") == SUBSCRIPTION and account.get("tenantId") == TENANT,
            "Azure login or subscription mismatch",
        )
    ]
    if checks[0]["status"] == "blocked":
        inventory = []
    else:
        inventory = az_json("resource", "list", "--resource-group", GROUP) or []
    counts = {}
    for resource in inventory:
        kind = resource["type"].lower()
        counts[kind] = counts.get(kind, 0) + 1
    storage_id = os.getenv("DOCS_STORAGE_ACCOUNT_ID", "")
    topic_id = os.getenv("DOCS_EVENT_GRID_TOPIC_ID", "")
    bus_id = os.getenv("DOCS_SERVICE_BUS_NAMESPACE_ID", "")
    for label, kind in (
        ("document_storage", "microsoft.storage/storageaccounts"),
        ("scan_topic", "microsoft.eventgrid/topics"),
        ("scan_queue_namespace", "microsoft.servicebus/namespaces"),
        ("postgresql", "microsoft.dbforpostgresql/flexibleservers"),
        ("application_runtime", "microsoft.app/containerapps"),
    ):
        checks.append(
            check(
                label,
                bool(counts.get(kind)),
                "Required resource type is absent in dev resource group",
            )
        )
    storage = properties(storage_id, "2023-05-01") or {}
    props = storage.get("properties") or {}
    checks.append(
        check(
            "selected_blob_security",
            props.get("publicNetworkAccess") == "Disabled"
            and props.get("allowSharedKeyAccess") is False
            and props.get("allowBlobPublicAccess") is False
            and props.get("minimumTlsVersion") == "TLS1_2",
            "Document account not selected, inaccessible, or security settings not verified",
        )
    )
    blob = (
        properties(storage_id + "/blobServices/default" if storage_id else "", "2023-05-01") or {}
    )
    checks.append(
        check(
            "blob_versioning",
            (blob.get("properties") or {}).get("isVersioningEnabled") is True,
            "Versioning not verified",
        )
    )
    defender = (
        properties(
            storage_id + "/providers/Microsoft.Security/defenderForStorageSettings/current"
            if storage_id
            else "",
            "2022-12-01-preview",
        )
        or {}
    )
    malware = (defender.get("properties") or {}).get("malwareScanning") or {}
    checks.append(
        check(
            "defender_on_upload",
            (malware.get("onUpload") or {}).get("isEnabled") is True
            and bool(topic_id)
            and malware.get("scanResultsEventGridTopicResourceId", "").lower() == topic_id.lower(),
            "Defender scanning/topic not verified",
        )
    )
    topic = properties(topic_id, "2022-06-15") or {}
    checks.append(
        check(
            "event_grid_identity",
            bool((topic.get("identity") or {}).get("principalId"))
            and topic.get("location") == storage.get("location")
            and (topic.get("properties") or {}).get("publicNetworkAccess") == "Enabled",
            "System identity, public Defender ingress or same-region topic not verified",
        )
    )
    bus = properties(bus_id, "2024-01-01") or {}
    checks.append(
        check(
            "service_bus_aad_only",
            (bus.get("properties") or {}).get("disableLocalAuth") is True,
            "Service Bus managed-identity-only authentication not verified",
        )
    )
    context = os.getenv("PRIVATE_AUTH_CONTEXT", "c1")
    reference = (
        az_json(
            "rest",
            "--method",
            "get",
            "--url",
            f"https://graph.microsoft.com/v1.0/identity/conditionalAccess/authenticationContextClassReferences/{context}",
        )
        or {}
    )
    policies = az_json(
        "rest",
        "--method",
        "get",
        "--url",
        "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies",
    )
    checks.append(
        check(
            "entra_context_available",
            reference.get("id") == context and reference.get("isAvailable") is True,
            "Context unavailable or Graph Policy.Read.ConditionalAccess access missing",
        )
    )
    checks.append(
        check(
            "entra_mfa_policy",
            isinstance(policies, dict)
            and any(policy_requires_mfa(p, context) for p in policies.get("value", [])),
            "Enabled MFA coverage not verified; exclusions, extra conditions and "
            "authentication-strength policies require separate review",
        )
    )
    report = {
        "status": "ready_for_live_test"
        if all(c["status"] == "pass" for c in checks)
        else "blocked",
        "resource_counts": counts,
        "checks": checks,
        "live_defender_test": "not_run",
        "private_network_probe": "not_run",
        "interactive_mfa_test": "not_run",
    }
    Path(os.environ.get("READINESS_REPORT", "readiness.json")).write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "ready_for_live_test" else 2


if __name__ == "__main__":
    raise SystemExit(main())
