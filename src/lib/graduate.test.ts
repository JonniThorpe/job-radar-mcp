import { test } from "node:test";
import assert from "node:assert/strict";
import { RADAR_MD, SKILLS_MD } from "./fixtures.test-data.js";
import { confirmSkill } from "./graduate.js";
import { findGap, recordGap } from "./radar.js";
import { findSkill } from "./skills.js";

test("la graduacion saca del radar y mete en el perfil, en su categoria", () => {
  const r = confirmSkill(
    RADAR_MD,
    SKILLS_MD,
    "Accessibility, a11y",
    "partial",
    "a11y course + audit of the OrderBot frontend"
  );
  assert.equal(r.ok, true);
  assert.equal(findGap(r.radar, "Accessibility, a11y"), undefined);

  const skill = findSkill(r.skills, "Accessibility, a11y")!;
  assert.equal(skill.level, "partial");
  // La categoria viene del parentesis que llevaba el hueco en el radar.
  assert.equal(skill.category, "Frontend");
  assert.match(skill.text, /a11y course/);
});

test("las fuentes del radar NO viajan al perfil", () => {
  const r = confirmSkill(RADAR_MD, SKILLS_MD, "Accessibility, a11y", "solid", "cert");
  assert.ok(!r.skills.includes("Acme Backend Engineer"));
  assert.ok(!r.skills.includes("Sources"));
});

test("graduar algo que no esta en el radar avisa y no toca ningun archivo", () => {
  const r = confirmSkill(RADAR_MD, SKILLS_MD, "COBOL", "solid", "life");
  assert.equal(r.ok, false);
  assert.equal(r.radar, RADAR_MD);
  assert.equal(r.skills, SKILLS_MD);
  assert.match(r.message, /not in the gap radar/);
});

test("graduar algo que ya esta en el perfil avisa y no duplica", () => {
  const r = confirmSkill(RADAR_MD, SKILLS_MD, "Docker", "solid", "x");
  assert.equal(r.ok, false);
  assert.equal(r.radar, RADAR_MD);
  assert.match(r.message, /update_skill_level/);
});

test("un hueco sin categoria pide que se le indique una", () => {
  const radar = recordGap(RADAR_MD, "Observability", "", "Offer Z").content;
  const without = confirmSkill(radar, SKILLS_MD, "Observability", "partial", "course");
  assert.equal(without.ok, false);
  assert.match(without.message, /no category/);

  const withCat = confirmSkill(radar, SKILLS_MD, "Observability", "partial", "course", "Backend");
  assert.equal(withCat.ok, true);
  assert.equal(findSkill(withCat.skills, "Observability")!.category, "Backend");
});

test("la categoria del radar puede no existir en el perfil: se crea", () => {
  const radar = recordGap(RADAR_MD, "Threat modelling", "Security", "Acme").content;
  const r = confirmSkill(radar, SKILLS_MD, "Threat modelling", "partial", "online course");
  assert.equal(r.ok, true);
  assert.match(r.skills, /## Security/);
  assert.match(r.message, /did not exist/);
});
