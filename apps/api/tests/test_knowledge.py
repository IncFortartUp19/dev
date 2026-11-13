from tests.test_vaults import vault


def test_approved_retrieval_citations_revocation_and_withdrawal(api):
    project = vault(api)
    base = f"/vaults/{project}/knowledge"
    source = api.request(
        "POST",
        base,
        "founder",
        json={
            "title": "Resultat revisat",
            "body": "Una prova smoke cobreix les seves assercions.",
            "source_reference": "private-evidence",
        },
    ).json()["id"]
    query = {"question": "smoke"}
    assert api.request("POST", base + "/answer", "founder", json=query).json()["citations"] == []
    assert api.request("GET", base + "/" + source, "founder").status_code == 404
    assert (
        api.request(
            "POST", base + "/" + source + "/state", "founder", json={"status": "approved"}
        ).status_code
        == 200
    )
    guest = api.request("GET", "/me", "guest").json()["id"]
    assert api.request("POST", base + "/answer", "guest", json=query).status_code == 404
    api.request(
        "POST", f"/vaults/{project}/members", "founder", json={"user_id": guest, "role": "reader"}
    )
    result = api.request("POST", base + "/answer", "guest", json=query)
    citation = result.json()["citations"][0]
    assert "private-evidence" not in result.text
    assert citation["source_id"] == source
    assert api.request("GET", base + "/" + source, "guest").status_code == 200
    assert (
        api.request(
            "POST", base + "/" + source + "/state", "guest", json={"status": "withdrawn"}
        ).status_code
        == 403
    )
    api.request("DELETE", f"/vaults/{project}/members/{guest}", "founder")
    assert api.request("GET", base + "/" + source, "guest").status_code == 404
    assert api.request("POST", base + "/answer", "guest", json=query).status_code == 404
    api.request("POST", base + "/" + source + "/state", "founder", json={"status": "withdrawn"})
    assert api.request("GET", base + "/" + source, "founder").status_code == 404
    assert api.request("POST", base + "/answer", "founder", json=query).json()["citations"] == []
    assert api.client.post("/v1" + base + "/answer", json=query).status_code == 401
