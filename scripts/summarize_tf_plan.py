"""Print only resource addresses and actions from a Terraform JSON plan."""

import json
import sys


def main():
    plan = json.load(sys.stdin)
    changes = []
    totals = {"create": 0, "update": 0, "delete": 0}
    for resource in plan.get("resource_changes", []):
        actions = resource["change"]["actions"]
        if actions in (["no-op"], ["read"]):
            continue
        for action in actions:
            if action in totals:
                totals[action] += 1
        changes.append((resource["address"], ", ".join(actions)))
    print("## Terraform plan — dev (France Central)\n")
    print(
        f"Create: **{totals['create']}** · Update: **{totals['update']}** · "
        f"Destroy: **{totals['delete']}**\n"
    )
    if changes:
        print("| Resource | Actions |\n| --- | --- |")
        for address, actions in changes:
            print(f"| `{address}` | {actions} |")
    else:
        print("No resource changes.\n")
    if plan.get("output_changes"):
        print("\nSee the plan logs for output changes; output values are omitted here.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
