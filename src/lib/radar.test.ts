import { test } from "node:test";
import assert from "node:assert/strict";
import { RADAR_MD } from "./fixtures.test-data.js";
import { findGap, listGaps, parseGaps, recordGap, removeGap, sortRadar } from "./radar.js";

const SRC = "Acme Backend Engineer, Remote";

test("sortRadar ordena cada seccion sin tocar la prosa ni perder lineas", () => {
  // El fixture viene con los contadores en orden 1, 3, 1.
  const sorted = sortRadar(RADAR_MD);
  const confirmed = parseGaps(sorted)
    .filter((g) => g.section === "Confirmed by offers")
    .map((g) => g.counter);
  assert.deepEqual(confirmed, [3, 1, 1]);
  assert.equal(sorted.split("\n").length, RADAR_MD.split("\n").length);
  assert.ok(sorted.includes("## Rules"));
  assert.ok(sorted.includes("- Skills I already have never live here."));
});

test("las vinietas de '## Rules' no se confunden con huecos", () => {
  const gaps = parseGaps(RADAR_MD);
  assert.equal(gaps.length, 5);
  assert.ok(!gaps.some((g) => g.term.includes("When an offer")));
});

test("parsea contador, categoria y fuentes", () => {
  const g = findGap(RADAR_MD, "Accessibility, a11y")!;
  assert.equal(g.counter, 1);
  assert.equal(g.category, "Frontend");
  // Una sola fuente: la coma esta DENTRO del nombre, el separador es ';'.
  assert.deepEqual(g.sources, [SRC]);
  assert.equal(g.section, "Confirmed by offers");
});

test("list_gaps ordena por contador descendente", () => {
  const order = listGaps(RADAR_MD).map((g) => g.counter);
  assert.deepEqual(order, [3, 1, 1, 0, 0]);
});

test("record_gap sobre un termino existente sube el contador y anade la fuente", () => {
  const r = recordGap(RADAR_MD, "Accessibility, a11y", "Frontend", "Globex Junior SDE");
  assert.equal(r.counter, 2);
  const g = findGap(r.content, "Accessibility, a11y")!;
  assert.equal(g.counter, 2);
  assert.deepEqual(g.sources, [SRC, "Globex Junior SDE"]);
  // No duplica: sigue habiendo 5 huecos.
  assert.equal(parseGaps(r.content).filter((x) => x.section !== "Tracked sources").length, 5);
});

test("record_gap dos veces seguidas deja contador 2", () => {
  const one = recordGap(RADAR_MD, "Rust", "Languages", "Offer A");
  assert.equal(one.counter, 1);
  const two = recordGap(one.content, "rust", "Languages", "Offer B");
  assert.equal(two.counter, 2);
  assert.equal(findGap(two.content, "Rust")!.counter, 2);
});

test("record_gap no repite una fuente ya registrada", () => {
  const r = recordGap(RADAR_MD, "Accessibility, a11y", "Frontend", SRC);
  assert.deepEqual(findGap(r.content, "Accessibility, a11y")!.sources, [SRC]);
  assert.match(r.message, /already listed/);
});

test("un termino de la watchlist sube a 1 pero se queda en la watchlist", () => {
  const r = recordGap(RADAR_MD, "Kubernetes", "Infrastructure", "Offer X");
  const g = findGap(r.content, "Kubernetes")!;
  assert.equal(g.counter, 1);
  assert.equal(g.section, "Watchlist");
  assert.deepEqual(g.sources, ["Offer X"]);
});

test("un termino nuevo nace con contador 1 en Confirmed by offers", () => {
  const r = recordGap(RADAR_MD, "Terraform", "Infrastructure", "Offer Y");
  const g = findGap(r.content, "Terraform")!;
  assert.equal(g.counter, 1);
  assert.equal(g.section, "Confirmed by offers");
  assert.equal(g.category, "Infrastructure");
});

test("record_gap lleva un contador por fuente en 'Tracked sources'", () => {
  let content = recordGap(RADAR_MD, "Terraform", "Infra", "Offer Y").content;
  content = recordGap(content, "Rust", "Languages", "Offer Y").content;
  const sources = parseGaps(content).filter((g) => g.section === "Tracked sources");
  assert.equal(sources.length, 1);
  assert.equal(sources[0]!.term, "Offer Y");
  assert.equal(sources[0]!.counter, 2);
});

test("la seccion se reordena por contador tras incrementar", () => {
  const r = recordGap(RADAR_MD, "Accessibility, a11y", "Frontend", "A");
  const r2 = recordGap(r.content, "Accessibility, a11y", "Frontend", "B");
  const r3 = recordGap(r2.content, "Accessibility, a11y", "Frontend", "C");
  const confirmed = parseGaps(r3.content)
    .filter((g) => g.section === "Confirmed by offers")
    .map((g) => g.counter);
  assert.deepEqual(confirmed, [4, 3, 1]);
});

test("la prosa y las secciones ajenas sobreviven a las escrituras", () => {
  const r = recordGap(RADAR_MD, "Terraform", "Infra", "Offer Y");
  assert.ok(r.content.includes("## Rules"));
  assert.ok(r.content.includes("- Skills I already have never live here."));
  assert.ok(r.content.includes("Hypotheses worth tracking that no offer has asked for yet."));
});

test("los finales de linea CRLF se conservan", () => {
  const crlf = RADAR_MD.replace(/\n/g, "\r\n");
  const r = recordGap(crlf, "Terraform", "Infra", "Offer Y");
  assert.ok(!/[^\r]\n/.test(r.content));
});

test("remove_gap saca la linea entera y avisa si no existe", () => {
  const r = removeGap(RADAR_MD, "Kubernetes");
  assert.equal(r.changed, true);
  assert.equal(r.gap!.counter, 0);
  assert.ok(!r.content.includes("Kubernetes"));

  const none = removeGap(RADAR_MD, "COBOL");
  assert.equal(none.changed, false);
  assert.equal(none.content, RADAR_MD);
});
