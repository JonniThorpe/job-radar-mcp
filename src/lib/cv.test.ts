import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { paths, REPO_DIR } from "../config.js";
import { CV_BASE, CV_REFERENCE } from "./fixtures.test-data.js";
import { parseCvBase, renderCv } from "./cv.js";

const TEMPLATE = fs.readFileSync(paths().cvTemplate, "utf8");
const render = (sel: Parameters<typeof renderCv>[1]) =>
  renderCv(CV_BASE, sel, TEMPLATE, "2026-07-28");

/**
 * Calibracion contra medida real. Un CV que llena la pagina, impreso con
 * Chrome headless y buscando por biseccion cuanto relleno admite antes de
 * saltar a dos paginas, deja ~35mm libres en el lateral y ~8mm en la
 * principal: 88% y 97% de ocupacion. El modelo tiene que reproducir esos dos
 * numeros sobre el CV de referencia, que tiene el mismo volumen de texto.
 *
 * Si este test se rompe, los avisos de desbordamiento de TODOS los demas CV
 * dejan de valer: o se ha tocado el CSS de la plantilla, o alguien ha movido
 * una constante sin repetir la medicion.
 */
test("el modelo reproduce la ocupacion medida del CV de referencia", () => {
  const r = render(CV_REFERENCE);
  assert.ok(Math.abs(r.usoMain - 97) <= 3, `main column at ${r.usoMain.toFixed(0)}%, measured 97%`);
  assert.ok(Math.abs(r.usoSidebar - 88) <= 3, `sidebar at ${r.usoSidebar.toFixed(0)}%, measured 88%`);
});

test("meterlo todo desborda, y avisa en vez de cortar en silencio", () => {
  const r = render({ offerId: "2026-07-test" });
  assert.ok(r.usoMain > 100);
  assert.ok(r.avisos.some((a) => a.startsWith("OVERFLOW") && a.includes("main column")));
  // El consejo es recortar lineas antes que quitar un proyecto entero.
  assert.ok(r.avisos.some((a) => a.includes("Trim project lines")));
});

test("una seleccion corta deja sitio de sobra y no avisa de nada", () => {
  const r = render({
    offerId: "2026-07-test",
    stack: [{ id: "languages", tags: ["Java", "Python"] }],
    experience: [{ id: "brightloop", bullets: ["brightloop-backend", "brightloop-coverage"] }],
    projects: ["orderbot"],
    education: ["bsc"]
  });
  assert.deepEqual(r.avisos, []);
  assert.ok(r.usoMain < 50);
});

test("un id inventado tumba el render entero y no escribe nada a medias", () => {
  assert.throws(
    () => render({ offerId: "x", projects: ["kubernetes-migration"] }),
    /"kubernetes-migration" does not exist.*Available: shelfscan/s
  );
});

test("un tag que no esta en los datos no se cuela en el CV", () => {
  assert.throws(
    () => render({ offerId: "x", stack: [{ id: "languages", tags: ["Java", "Kotlin"] }] }),
    /cannot be invented: "Kotlin"/
  );
});

test("se reportan todos los errores de una vez, no de uno en uno", () => {
  try {
    render({
      offerId: "x",
      projects: ["ghost"],
      education: ["mit"],
      experience: [{ id: "brightloop", bullets: ["brightloop-nasa"] }]
    });
    assert.fail("should have thrown");
  } catch (err) {
    const msg = (err as Error).message;
    assert.match(msg, /ghost/);
    assert.match(msg, /mit/);
    assert.match(msg, /brightloop-nasa/);
  }
});

test("el orden pedido manda sobre el orden de cv-data.json", () => {
  const r = render({ offerId: "x", projects: ["portfolio", "shelfscan"] });
  const iPortfolio = r.html.indexOf("Self-hosted Portfolio");
  const iShelf = r.html.indexOf("ShelfScan");
  assert.ok(iPortfolio > 0 && iShelf > 0);
  assert.ok(iPortfolio < iShelf, "portfolio should come before shelfscan");
  // Y lo no pedido no aparece.
  assert.equal(r.html.includes("Online Store"), false);
});

test("headline y summary admiten texto libre; el <br> del titular sobrevive", () => {
  const r = render({
    offerId: "x",
    headline: "Backend Engineer ·<br>Java & Spring",
    summary: "Summary tailored to this offer."
  });
  assert.match(r.html, /<div class="headline">Backend Engineer ·<br>Java &amp; Spring<\/div>/);
  assert.match(r.html, /Summary tailored to this offer\./);
});

test("location sustituye la ubicacion de cv-data.json solo en esta version", () => {
  const r = render({ offerId: "x", location: "Northbridge · Open to remote" });
  assert.match(r.html, /<span>Northbridge · Open to remote<\/span>/);
  assert.equal(r.html.includes("Westland, Exampleland"), false);
  assert.match(render({ offerId: "x" }).html, /Westland, Exampleland/);
});

test("el texto se escapa: nada de HTML inyectado desde los datos", () => {
  const r = render({ offerId: "x", summary: "<script>alert(1)</script>" });
  assert.equal(r.html.includes("<script>alert(1)"), false);
  assert.match(r.html, /&lt;script&gt;/);
});

test("un '$' en el texto sale tal cual, sin patrones de reemplazo", () => {
  const summary = "Cut costs by $& and $` and $' here, saving $1k.";
  const r = render({ offerId: "x", summary, note: "pays in $$" });
  assert.ok(r.html.includes(summary.replace(/&/g, "&amp;")));
  assert.ok(r.html.includes("pays in $$"));
});

test("la nota de por que se adapto queda dentro del HTML, fuera de la vista", () => {
  const r = render({ offerId: "2026-07-acme", note: "they want Java and quality" });
  assert.match(r.html, /<!-- Tailored to 2026-07-acme: they want Java and quality -->/);
});

test("no queda ningun marcador de plantilla sin sustituir", () => {
  const r = render(CV_REFERENCE);
  assert.equal(/\{\{[A-Z]+\}\}/.test(r.html), false);
});

test("el cv-data.json de example-vault cumple el esquema y renderiza", () => {
  const json = fs.readFileSync(path.join(REPO_DIR, "example-vault", "profile", "cv-data.json"), "utf8");
  const base = parseCvBase(json);
  const r = renderCv(base, { offerId: "2026-07-test" }, TEMPLATE, "2026-07-28");
  assert.ok(r.html.includes(base.identity.name));
});

test("un cv-data.json mal formado se explica, no revienta con un stack trace", () => {
  assert.throws(() => parseCvBase("{ this is not json"), /not valid JSON/);
  assert.throws(() => parseCvBase('{"summary":"x"}'), /does not match the expected schema/);
});

test("un proyecto se puede recortar a las lineas que aportan a la oferta", () => {
  const r = render({ offerId: "x", projects: [{ id: "shelfscan", lines: ["Build"] }] });
  assert.match(r.html, /<b>Build:<\/b>/);
  assert.equal(r.html.includes("<b>Need:</b>"), false);
  assert.equal(r.html.includes("<b>Idea:</b>"), false);
  // El proyecto sigue estando: se encoge, no se borra.
  assert.match(r.html, /ShelfScan/);
});

test("recortar lineas gana sitio sin sacar el proyecto del CV", () => {
  const all = render({ offerId: "x", projects: ["shelfscan", "orderbot", "portfolio"] });
  const onlyBuild = render({
    offerId: "x",
    projects: [
      { id: "shelfscan", lines: ["Build"] },
      { id: "orderbot", lines: ["Build"] },
      { id: "portfolio", lines: ["Build"] }
    ]
  });
  assert.ok(onlyBuild.usoMain < all.usoMain);
  for (const title of ["ShelfScan", "OrderBot", "Self-hosted Portfolio"]) {
    assert.ok(onlyBuild.html.includes(title), `missing ${title}`);
  }
});

test("una linea inventada tumba el render y dice cuales hay", () => {
  assert.throws(
    () => render({ offerId: "x", projects: [{ id: "shelfscan", lines: ["Build", "Deploy"] }] }),
    /these lines do not exist: "Deploy".*Available: Need, Idea, Build/s
  );
});
