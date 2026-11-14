import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIdeaDrafts, pendingIdeaFields, validateIdea, type IdeaDraft } from "./idea-drafts";

const sample: IdeaDraft = {
  id: "draft-1", question: "Com reduir els residus?", intention: "",
  nextTest: "", name: "", scope: "personal-local", updatedAt: "2026-11-14T10:00:00.000Z",
};
test("question is required but intention and next test may remain pending", () => {
  assert.equal(validateIdea(sample), null);
  assert.deepEqual(pendingIdeaFields(sample), ["Intenció", "Propera prova"]);
  assert.match(validateIdea({ ...sample, question: "  " }) ?? "", /pregunta/);
});
test("local drafts persist after serialization and reject invalid data", () => {
  assert.deepEqual(parseIdeaDrafts(JSON.stringify([sample])), [sample]);
  assert.deepEqual(parseIdeaDrafts(null), []);
  assert.throws(() => parseIdeaDrafts("{invalid"));
  assert.throws(() => parseIdeaDrafts(JSON.stringify([{ ...sample, scope: "public" }])));
  assert.throws(() => parseIdeaDrafts(JSON.stringify([sample, sample])));
  assert.throws(() => parseIdeaDrafts(JSON.stringify([{ ...sample, question: "" }])));
});
test("field lengths are bounded", () => {
  assert.ok(validateIdea({ ...sample, name: "x".repeat(121) }));
});
