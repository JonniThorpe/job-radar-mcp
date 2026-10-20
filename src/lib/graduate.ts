import { removeGap } from "./radar.js";
import { addSkill, findSkill, type SkillLevel } from "./skills.js";

/**
 * La graduacion: unico camino de hueco a perfil.
 *
 * Toca DOS archivos, y por eso vive aparte. Devuelve los dos contenidos nuevos
 * sin escribir nada: quien llama decide si persiste. Asi la operacion se puede
 * testear entera y, si alguna comprobacion falla, se aborta antes de escribir
 * ningun archivo.
 *
 * Decision de diseno: las FUENTES del radar se descartan. Al perfil solo viaja
 * la evidencia (cert, proyecto, experiencia), nunca la oferta que origino el
 * hueco. El perfil dice lo que se, no por que lo aprendi.
 */
export interface GraduateResult {
  ok: boolean;
  radar: string;
  skills: string;
  message: string;
}

export function confirmSkill(
  radarContent: string,
  skillsContent: string,
  term: string,
  level: SkillLevel,
  evidence: string,
  categoryOverride?: string
): GraduateResult {
  const unchanged = (message: string): GraduateResult => ({
    ok: false,
    radar: radarContent,
    skills: skillsContent,
    message
  });

  const inProfile = findSkill(skillsContent, term);
  if (inProfile) {
    return unchanged(
      `"${inProfile.term}" is already in skills.md ("${inProfile.category}", [${inProfile.level}]). Use update_skill_level to change its level.`
    );
  }

  const removal = removeGap(radarContent, term);
  if (!removal.changed || !removal.gap) {
    return unchanged(
      `"${term}" is not in the gap radar, so there is nothing to graduate. If it is a new skill that never went through the radar, add it to skills.md yourself.`
    );
  }

  const category = (categoryOverride ?? removal.gap.category ?? "").trim();
  if (!category) {
    return unchanged(
      `"${removal.gap.term}" has no category in the radar. Pass one so it can be placed under the right "##" heading in the profile.`
    );
  }

  const added = addSkill(skillsContent, category, removal.gap.term, level, evidence);
  if (!added.changed) return unchanged(added.message);

  return {
    ok: true,
    radar: removal.content,
    skills: added.content,
    message: `Graduated "${removal.gap.term}": out of the radar (count ${removal.gap.counter}) and into "${category}" as [${level}]. ${added.message}`
  };
}
