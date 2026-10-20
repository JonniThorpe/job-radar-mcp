import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { assertSafeId, checkDataDir, listOffers, writeAtomic } from "./files.js";
import { buildOffer } from "./offers.js";

test("assertSafeId acepta ids normales y recorta espacios", () => {
  assert.equal(assertSafeId(" 2026-07-acme "), "2026-07-acme");
  assert.equal(assertSafeId("2026-07-acme_v2.1"), "2026-07-acme_v2.1");
});

test("assertSafeId no deja salir de offers/", () => {
  for (const bad of ["../secrets", "a/b", "a\\b", "..", ".", "", "c:evil", "acme corp"]) {
    assert.throws(() => assertSafeId(bad), /Invalid offer id/, `should reject ${JSON.stringify(bad)}`);
  }
});

test("checkDataDir explica como crear la boveda si no existe, y no la crea", () => {
  const missing = path.join(os.tmpdir(), `job-radar-missing-${process.pid}-${Date.now()}`);
  const msg = checkDataDir(missing);
  assert.ok(msg && msg.includes(missing));
  assert.match(msg!, /example-vault/);
  assert.match(msg!, /JOB_MCP_DATA_DIR/);
  assert.equal(fs.existsSync(missing), false);
});

test("checkDataDir crea profile/ y offers/ dentro de una boveda que ya existe", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "job-radar-"));
  try {
    assert.equal(checkDataDir(dir), undefined);
    assert.ok(fs.existsSync(path.join(dir, "profile")));
    assert.ok(fs.existsSync(path.join(dir, "offers")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("listOffers lee el frontmatter y ordena por fecha de actualizacion", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "job-radar-"));
  try {
    const offer = (id: string, date: string) =>
      writeAtomic(
        path.join(dir, "offers", `${id}.md`),
        buildOffer({ id, title: `Role ${id}`, company: "Acme", markdown: "x", date })
      );
    offer("2026-06-old", "2026-06-01");
    offer("2026-07-new", "2026-07-01");
    fs.writeFileSync(path.join(dir, "offers", "notes.txt"), "ignored");

    const list = listOffers(dir);
    assert.deepEqual(list.map((o) => o.id), ["2026-07-new", "2026-06-old"]);
    assert.equal(list[0]!.status, "analyzed");
    assert.equal(list[0]!.title, "Role 2026-07-new");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("listOffers sin carpeta de ofertas devuelve una lista vacia", () => {
  assert.deepEqual(listOffers(path.join(os.tmpdir(), `nope-${Date.now()}`)), []);
});
