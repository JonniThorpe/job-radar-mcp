import { test } from "node:test";
import assert from "node:assert/strict";
import { SKILLS_MD } from "./fixtures.test-data.js";
import {
  addSkill,
  extractTerm,
  findSkill,
  listCategories,
  parseSkills,
  resolveCategory,
  updateSkillLevel
} from "./skills.js";

test("parsea las skills con su categoria", () => {
  const skills = parseSkills(SKILLS_MD);
  assert.equal(skills.length, 8);
  assert.equal(skills[0]!.term, "Java");
  assert.equal(skills[0]!.level, "solid");
  assert.equal(skills[0]!.category, "Programming languages");
  assert.equal(skills.at(-1)!.category, "Infrastructure, DevOps and deployment");
});

test("el termino se separa de la nota final, pero no de las comas internas", () => {
  assert.equal(extractTerm("Java (Java 17, two years at Brightloop)"), "Java");
  assert.equal(
    extractTerm("Testing: JUnit 5, Mockito, code coverage"),
    "Testing: JUnit 5, Mockito, code coverage"
  );
  assert.equal(extractTerm("Kubernetes (Infrastructure)."), "Kubernetes");
});

test("la busqueda ignora mayusculas y acentos", () => {
  assert.equal(findSkill(SKILLS_MD, "  jAVA  ")!.term, "Java");
  assert.equal(findSkill(SKILLS_MD, "Doçker")!.term, "Docker");
  assert.equal(findSkill(SKILLS_MD, "System design"), undefined);
});

test("listCategories devuelve solo las cabeceras de nivel 2", () => {
  assert.deepEqual(listCategories(SKILLS_MD), [
    "Programming languages",
    "Backend",
    "Infrastructure, DevOps and deployment"
  ]);
});

test("update_skill_level cambia la etiqueta y conserva el resto de la linea", () => {
  const r = updateSkillLevel(SKILLS_MD, "Cloud GPUs", "solid");
  assert.equal(r.changed, true);
  assert.match(r.content, /- \[solid\] Cloud GPUs \(used for fine-tuning, not in production\)/);
  // Ni una linea mas ni una menos: edicion quirurgica.
  assert.equal(r.content.split("\n").length, SKILLS_MD.split("\n").length);
});

test("update_skill_level al mismo nivel no cambia nada", () => {
  const r = updateSkillLevel(SKILLS_MD, "Docker", "solid");
  assert.equal(r.changed, false);
  assert.match(r.message, /was already/);
});

test("update_skill_level sobre algo que no esta avisa y no toca nada", () => {
  const r = updateSkillLevel(SKILLS_MD, "Kubernetes", "partial");
  assert.equal(r.changed, false);
  assert.equal(r.content, SKILLS_MD);
  assert.match(r.message, /confirm_skill/);
});

test("add_skill inserta bajo la categoria existente, sin duplicar", () => {
  const r = addSkill(SKILLS_MD, "Backend", "Kafka", "partial", "internal course");
  assert.equal(r.changed, true);
  const lines = r.content.split("\n");
  const idx = lines.findIndex((l) => l.includes("Kafka"));
  assert.equal(lines[idx], "- [partial] Kafka (internal course)");
  // Ha caido dentro de Backend, antes de la siguiente cabecera.
  assert.ok(idx > lines.indexOf("## Backend"));
  assert.ok(idx < lines.indexOf("## Infrastructure, DevOps and deployment"));

  const again = addSkill(r.content, "Backend", "kafka", "solid", "something else");
  assert.equal(again.changed, false);
  assert.match(again.message, /already in skills\.md/);
});

test("resolveCategory casa el nombre corto del radar con la cabecera larga del perfil", () => {
  assert.deepEqual(resolveCategory(SKILLS_MD, "Backend"), { name: "Backend", how: "exact" });
  const r = resolveCategory(SKILLS_MD, "Infrastructure");
  assert.equal(r.how, "prefix");
  assert.equal(r.name, "Infrastructure, DevOps and deployment");
  // Sin parecido, se crea nueva.
  assert.equal(resolveCategory(SKILLS_MD, "Security").how, "new");
  // El corte debe caer en limite de palabra: 'Back' no casa con 'Backend'.
  assert.equal(resolveCategory(SKILLS_MD, "Back").how, "new");
});

test("resolveCategory avisa si el prefijo encaja con varias cabeceras", () => {
  const md = "## Data, storage\n- [solid] SQL\n\n## Data, pipelines\n- [partial] Airflow\n";
  const r = resolveCategory(md, "Data");
  assert.equal(r.how, "ambiguous");
  assert.equal(addSkill(md, "Data", "dbt", "partial").changed, false);
});

test("add_skill reutiliza la categoria existente en vez de crear una paralela", () => {
  const r = addSkill(SKILLS_MD, "Infrastructure", "Kubernetes", "partial", "CKA course");
  assert.equal(r.changed, true);
  // Una sola cabecera de infraestructura, la de siempre.
  assert.equal(r.content.match(/^## Infrastructure/gm)!.length, 1);
  assert.equal(findSkill(r.content, "Kubernetes")!.category, "Infrastructure, DevOps and deployment");
  assert.match(r.message, /the radar category was "Infrastructure"/);
});

test("add_skill crea la categoria si no existe", () => {
  const r = addSkill(SKILLS_MD, "Security", "Threat modelling", "partial", "course");
  assert.equal(r.changed, true);
  assert.match(r.content, /## Security\n- \[partial\] Threat modelling \(course\)/);
  assert.match(r.message, /did not exist/);
});
