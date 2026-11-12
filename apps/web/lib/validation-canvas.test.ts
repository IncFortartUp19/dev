import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyCanvas,
  readCanvas,
  nextValidationStep,
} from "./validation-canvas";

test("import rejects incompatible and oversized drafts and ignores unknown fields", () => {
  const canvas = emptyCanvas();
  canvas.fields.name = "Projecte pilot";
  assert.deepEqual(
    readCanvas(JSON.stringify({ ...canvas, secret: "ignore" })),
    canvas,
  );
  for (const raw of [
    "null",
    "{}",
    '{"schema":2}',
    "{",
    JSON.stringify({ ...canvas, fields: { ...canvas.fields, problem: 1 } }),
    JSON.stringify({
      ...canvas,
      fields: { ...canvas.fields, name: "x".repeat(4001) },
    }),
    " ".repeat(100001),
  ])
    assert.throws(() => readCanvas(raw));
});
test("guidance follows validation evidence rather than treating completion as viability", () => {
  const canvas = emptyCanvas();
  assert.match(nextValidationStep(canvas), /problema i el públic/);
  canvas.fields.problem = " ";
  canvas.fields.audience = "Persones que fan la prova";
  assert.match(nextValidationStep(canvas), /problema i el públic/);
  canvas.fields.problem = "Una dificultat observada";
  assert.match(nextValidationStep(canvas), /hipòtesi/);
  canvas.fields.hypothesis = "La prova reduirà el temps";
  canvas.fields.experiment = "Mesura amb un prototip";
  assert.match(nextValidationStep(canvas), /criteri/);
  canvas.fields.criterion = "Reduir el temps a la meitat";
  assert.match(nextValidationStep(canvas), /registra els resultats/);
  canvas.fields.evidence = "La prova no ha reduït el temps";
  assert.match(nextValidationStep(canvas), /aprenentatge/);
  canvas.fields.learning = "Canviar la hipòtesi";
  assert.match(nextValidationStep(canvas), /no demostra.*viable/);
});
