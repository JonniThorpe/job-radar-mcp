import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addOfferNote,
  buildOffer,
  isOfferStatus,
  parseFrontmatter,
  replaceAnalysis,
  setFrontmatterField,
  setOfferStatus,
  yamlList
} from "./offers.js";

const OFFER = buildOffer({
  id: "2026-07-acme",
  title: "Backend Engineer, Platform",
  company: "Acme",
  markdown: "## Fit\nHigh.\n\n## Risks\nDistributed systems.",
  date: "2026-07-27"
});

test("build_offer produce frontmatter y las tres secciones fijas", () => {
  const { data } = parseFrontmatter(OFFER);
  assert.equal(data.id, "2026-07-acme");
  assert.equal(data.company, "Acme");
  assert.equal(data.status, "analyzed");
  assert.equal(data.created, "2026-07-27");
  assert.ok(OFFER.includes("## Analysis"));
  assert.ok(OFFER.includes("## Status log"));
  assert.ok(OFFER.includes("## Interview notes"));
  assert.ok(OFFER.includes("- 2026-07-27: analyzed"));
});

test("los campos opcionales se escriben aunque vengan vacios", () => {
  const { data } = parseFrontmatter(OFFER);
  assert.equal(data.score, "");
  assert.equal(data.salary, "");
  assert.equal(data.url, "");
  assert.equal(data.tags, "[]");
});

test("score, salary, url y tags se serializan cuando llegan", () => {
  const md = buildOffer({
    id: "2026-07-globex",
    title: "Backend Engineer",
    company: "Globex",
    markdown: "1. **Verdict**: reasonable reach.",
    date: "2026-07-27",
    score: 9,
    salary: "38,000 - 45,000 EUR",
    url: "https://globex.example/jobs/42",
    tags: ["backend", "ml"]
  });
  const { data } = parseFrontmatter(md);
  assert.equal(data.score, "9");
  assert.equal(data.salary, "38,000 - 45,000 EUR");
  assert.equal(data.url, "https://globex.example/jobs/42");
  assert.equal(data.tags, "[backend, ml]");
});

test("al actualizar, los tags siguen siendo una lista YAML y no un texto citado", () => {
  const md = buildOffer({ id: "x", title: "T", company: "C", markdown: "a", date: "2026-07-27", tags: ["a"] });
  const updated = setFrontmatterField(md, "tags", yamlList(["a", "b"]), true);
  assert.ok(updated.includes("\ntags: [a, b]\n"));
  assert.ok(!updated.includes('tags: "['));
});

test("una url con query se serializa igual al crear y al actualizar", () => {
  const url = "https://globex.example/jobs?id=42";
  const created = buildOffer({ id: "x", title: "T", company: "C", markdown: "a", date: "d", url });
  const line = (s: string) => s.split("\n").find((l) => l.startsWith("url:"));
  assert.equal(line(setFrontmatterField(created, "url", url)), line(created));
  assert.equal(parseFrontmatter(created).data.url, url);
});

test("el analisis con listas numeradas de la plantilla se conserva intacto", () => {
  const template = [
    "1. **Verdict**: reasonable reach.",
    "",
    "2. **What I already have**",
    "   - Spring Boot: backend of the OrderBot project.",
    "",
    "5. **Terms I do not master**",
    "   - sharding, quorum"
  ].join("\n");
  const md = buildOffer({ id: "x", title: "T", company: "C", markdown: template, date: "2026-07-27" });
  for (const line of template.split("\n")) assert.ok(md.includes(line));
});

test("un titulo con coma se serializa citado para no romper el YAML", () => {
  const { data } = parseFrontmatter(OFFER);
  assert.equal(data.title, "Backend Engineer, Platform");
});

test("los estados validos son los siete del ciclo de vida", () => {
  assert.ok(isOfferStatus("interview"));
  assert.ok(isOfferStatus("discarded"));
  assert.ok(!isOfferStatus("pending"));
  assert.ok(!isOfferStatus("ANALYZED"));
});

test("set_offer_status actualiza frontmatter y deja rastro fechado", () => {
  const r = setOfferStatus(OFFER, "applied", "2026-07-28");
  assert.equal(r.changed, true);
  const { data } = parseFrontmatter(r.content);
  assert.equal(data.status, "applied");
  assert.equal(data.updated, "2026-07-28");
  assert.ok(r.content.includes("- 2026-07-28: analyzed -> applied"));
  // El registro anterior no se pisa.
  assert.ok(r.content.includes("- 2026-07-27: analyzed"));
});

test("set_offer_status al mismo estado no hace nada", () => {
  const r = setOfferStatus(OFFER, "analyzed", "2026-07-28");
  assert.equal(r.changed, false);
  assert.equal(r.content, OFFER);
});

test("las notas se acumulan fechadas y admiten varias lineas", () => {
  const a = addOfferNote(OFFER, "Interview with Sam.\nThey asked about concurrency.", "2026-07-29");
  const b = addOfferNote(a.content, "Second round.", "2026-08-02");
  assert.ok(b.content.includes("### 2026-07-29"));
  assert.ok(b.content.includes("They asked about concurrency."));
  assert.ok(b.content.includes("### 2026-08-02"));
  assert.ok(b.content.indexOf("### 2026-07-29") < b.content.indexOf("### 2026-08-02"));
  assert.equal(parseFrontmatter(b.content).data.updated, "2026-08-02");
});

test("una nota vacia se rechaza", () => {
  const r = addOfferNote(OFFER, "   ", "2026-07-29");
  assert.equal(r.changed, false);
});

test("reguardar la oferta sustituye el analisis pero conserva estado y notas", () => {
  const withNote = addOfferNote(OFFER, "Contact: Sam.", "2026-07-29").content;
  const advanced = setOfferStatus(withNote, "interview", "2026-07-30").content;
  const r = replaceAnalysis(advanced, "## Fit\nRevised down.", "2026-07-31");

  assert.equal(r.changed, true);
  assert.ok(r.content.includes("Revised down."));
  assert.ok(!r.content.includes("High."));
  assert.ok(r.content.includes("Contact: Sam."));
  assert.equal(parseFrontmatter(r.content).data.status, "interview");
  assert.equal(parseFrontmatter(r.content).data.updated, "2026-07-31");
});

test("reguardar sin seccion de analisis no toca nada y lo dice", () => {
  const md = "---\nid: x\n---\n# Renamed by hand\n";
  const r = replaceAnalysis(md, "new", "2026-07-31");
  assert.equal(r.changed, false);
  assert.equal(r.content, md);
  assert.match(r.message, /## Analysis/);
});
