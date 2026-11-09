import { test } from "node:test";
import assert from "node:assert/strict";
import { readStore, rubric, score, seed, status } from "./model";

test("rubric weights total 100 and weighted score uses every criterion", () => {
  assert.equal(
    rubric.reduce((n, c) => n + c.weight, 0),
    100,
  );
  assert.equal(score([10, 0, 0, 0]), 3);
  assert.equal(score([8, 7, 6, 8]), 7.2);
  for (const invalid of [
    [NaN, 1, 1, 1],
    [11, 1, 1, 1],
    [-1, 1, 1, 1],
    [8, 8],
  ])
    assert.throws(() => score(invalid));
});
test("a new submission reopens review without removing historical feedback", () => {
  const project = seed().projects[1];
  assert.equal(status(project), "Avaluat");
  const next = {
    ...project,
    deliveries: [
      ...project.deliveries,
      {
        id: "new",
        note: "Revision",
        date: new Date().toISOString(),
        files: [],
      },
    ],
  };
  assert.equal(status(next), "Pendent de revisió");
  assert.ok(next.deliveries[0].review);
  assert.equal(status(seed().projects[2]), "Esborrany");
});
test("local state round-trips and malformed data fails before rendering", () => {
  assert.deepEqual(readStore(JSON.stringify(seed())), seed());
  assert.deepEqual(readStore(null), seed());
  assert.throws(() => readStore("{bad"));
  assert.throws(() => readStore('{"schema":1,"spaces":[],"projects":[{}]}'));
  const bad = seed();
  bad.projects[1].deliveries[0].review!.scores = [99, 0, 0, 0];
  assert.throws(() => readStore(JSON.stringify(bad)));
});
