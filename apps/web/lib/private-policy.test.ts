import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boundedBytes,
  MAX_DOCUMENT_BYTES,
  privateClaims,
  privateRoute,
} from "./private-policy";
const id = "00000000-0000-0000-0000-000000000001";
test("private proxy allows only scoped metadata, upload and download routes", () => {
  assert.equal(privateRoute("POST", ["vaults", id, "documents"]), "upload");
  assert.equal(
    privateRoute("GET", ["vaults", id, "documents", id, "content"]),
    "download",
  );
  for (const path of [
    ["vaults", id, "documents", "..", "content"],
    ["vaults", id, "members"],
    ["https:", "attacker"],
    ["vaults", id + "%2f", "documents"],
  ])
    assert.equal(privateRoute("GET", path), null);
  assert.equal(privateRoute("GET", ["idea-drafts"]), "json");
  assert.equal(privateRoute("POST", ["idea-drafts"]), "json");
  assert.equal(privateRoute("POST", ["idea-drafts", id]), "json");
  assert.equal(privateRoute("GET", ["idea-drafts", id]), "json");
  assert.equal(privateRoute("GET", ["idea-drafts", "invalid"]), null);
  assert.equal(privateRoute("DELETE", ["vaults", id]), null);
  assert.deepEqual(JSON.parse(privateClaims("c1")), {
    access_token: { acrs: { essential: true, value: "c1" } },
  });
});
test("binary proxy limits incoming and outgoing bytes", async () => {
  assert.equal(MAX_DOCUMENT_BYTES, 10485760);
  const bytes = await boundedBytes(
    new Response(new Uint8Array([0, 255, 1])),
    3,
  );
  assert.deepEqual([...bytes], [0, 255, 1]);
  await assert.rejects(boundedBytes(new Response("too large"), 2));
});
