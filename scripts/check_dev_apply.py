"""Allow only the two reviewed dev resource creations, or an unchanged plan."""

import json
import sys


ALLOWED_CREATES = {"azurerm_key_vault.dev", "azurerm_log_analytics_workspace.dev"}


def main():
    plan = json.load(sys.stdin)
    if plan.get("errored") or plan.get("complete") is False:
        print("The Terraform plan is incomplete or errored.", file=sys.stderr)
        return 1
    for resource in plan.get("resource_changes", []):
        actions = resource["change"]["actions"]
        if actions == ["no-op"]:
            continue
        if resource.get("mode") == "data" and actions == ["read"]:
            continue
        if resource["address"] in ALLOWED_CREATES and actions == ["create"]:
            continue
        print(f"Unexpected change: {resource['address']} {actions}", file=sys.stderr)
        return 1
    print("Plan matches the authorized dev resource creations; no updates or deletions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
