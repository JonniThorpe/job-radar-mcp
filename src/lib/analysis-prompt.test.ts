import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { REPO_DIR } from "../config.js";
import { buildAnalysisPrompt, extractGoal } from "./analysis-prompt.js";

const CRITERIA = `# Criteria

## Goal
<!-- One or two sentences. -->
Backend engineer at a product company, moving towards ML platform work.

## Deal-breakers
- Requires relocation.
`;

test("extractGoal lee la seccion '## Goal' y descarta los comentarios", () => {
  assert.equal(
    extractGoal(CRITERIA),
    "Backend engineer at a product company, moving towards ML platform work."
  );
});

test("extractGoal devuelve undefined si falta la seccion, esta vacia o no hay archivo", () => {
  assert.equal(extractGoal(undefined), undefined);
  assert.equal(extractGoal("# Criteria\n\n## Deal-breakers\n- x\n"), undefined);
  assert.equal(extractGoal("## Goal\n<!-- write it here -->\n\n## Other\n"), undefined);
});

test("el prompt incluye el objetivo leido de criteria.md", () => {
  const p = buildAnalysisPrompt({ skills: "S", criteria: CRITERIA, cv: "CV" });
  assert.match(p, /My long-term career goal \(from criteria\.md\):\n\nBackend engineer at a product company/);
  assert.ok(!p.includes("has no `## Goal` section"));
});

test("sin objetivo, el prompt pide al usuario que lo defina", () => {
  const p = buildAnalysisPrompt({ skills: "S", criteria: "# Criteria\n", cv: undefined });
  assert.match(p, /has no `## Goal` section/);
  assert.match(p, /ask me to state it/);
  // Y sin cv.md avisa de que la evidencia sera menos concreta.
  assert.match(p, /There is no profile\/cv\.md/);
});

test("el criteria.md de example-vault tiene un objetivo", () => {
  const criteria = fs.readFileSync(path.join(REPO_DIR, "example-vault", "profile", "criteria.md"), "utf8");
  assert.ok(extractGoal(criteria));
});
