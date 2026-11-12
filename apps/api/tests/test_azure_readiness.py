from copy import deepcopy

from campus_api import azure_readiness as readiness


def test_mfa_preflight_rejects_report_only_exclusions_and_alternative_grants():
    policy = {
        "state": "enabled",
        "conditions": {
            "users": {"includeUsers": ["All"]},
            "clientAppTypes": ["all"],
            "applications": {"includeAuthenticationContextClassReferences": ["c1"]},
        },
        "grantControls": {"operator": "OR", "builtInControls": ["mfa"]},
    }
    assert readiness.policy_requires_mfa(policy, "c1")
    assert not readiness.policy_requires_mfa(policy, "c2")
    for key, value in (
        ("state", "enabledForReportingButNotEnforced"),
        ("grantControls", {"operator": "OR", "builtInControls": ["mfa", "compliantDevice"]}),
    ):
        modified = {**policy, key: value}
        assert not readiness.policy_requires_mfa(modified, "c1")
    for condition in (
        {"users": {"includeUsers": ["All"], "excludeUsers": ["excluded"]}},
        {"locations": {"includeLocations": ["some-location"]}},
        {"devices": {"deviceFilter": {"mode": "exclude", "rule": "some-rule"}}},
    ):
        modified = deepcopy(policy)
        modified["conditions"].update(condition)
        assert not readiness.policy_requires_mfa(modified, "c1")


def test_preflight_does_not_claim_live_validation_when_resources_are_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(
        readiness,
        "az_json",
        lambda *args: (
            {"id": readiness.SUBSCRIPTION, "tenantId": readiness.TENANT}
            if args == ("account", "show")
            else []
        ),
    )
    target = tmp_path / "evidence.json"
    monkeypatch.setenv("READINESS_REPORT", str(target))
    for key in (
        "DOCS_STORAGE_ACCOUNT_ID",
        "DOCS_EVENT_GRID_TOPIC_ID",
        "DOCS_SERVICE_BUS_NAMESPACE_ID",
    ):
        monkeypatch.delenv(key, raising=False)
    assert readiness.main() == 2
    assert '"live_defender_test": "not_run"' in target.read_text()
    assert '"status": "blocked"' in target.read_text()
