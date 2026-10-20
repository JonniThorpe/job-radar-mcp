import {
  appendToSection,
  detectEol,
  findHeadings,
  findSection,
  fromLines,
  normalize,
  toLines
} from "./markdown.js";

/** En skills.md solo hay cosas que YA tengo. Nunca huecos. */
export const SKILL_LEVELS = ["solid", "partial"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export function isSkillLevel(value: string): value is SkillLevel {
  return (SKILL_LEVELS as readonly string[]).includes(value);
}

export interface Skill {
  category: string;
  level: SkillLevel;
  /** Termino sin la nota entre parentesis: 'Java'. */
  term: string;
  /** Todo lo que sigue a la etiqueta: 'Java (two years at Brightloop)'. */
  text: string;
  lineIndex: number;
  raw: string;
}

// '- [solid] Java (two years, ...)'  ->  vinieta | nivel | resto
const SKILL_RE = /^(\s*[-*]\s+)\[(solid|partial)\]\s*(.+?)\s*$/i;

/**
 * El termino es el texto anterior a la nota final entre parentesis. Ojo: las
 * lineas reales llevan comas y dos puntos dentro ('Testing: JUnit 5, Mockito'),
 * asi que solo se recorta el ULTIMO parentesis y solo si cierra la linea.
 */
export function extractTerm(text: string): string {
  const m = /^(.*?)\s*\([^()]*\)\s*\.?\s*$/.exec(text);
  return (m ? m[1]! : text).replace(/\.\s*$/, "").trim();
}

export function parseSkills(content: string): Skill[] {
  const lines = toLines(content);
  const headings = findHeadings(lines);
  const out: Skill[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = SKILL_RE.exec(lines[i]!);
    if (!m) continue;
    let category = "";
    for (const h of headings) {
      if (h.index < i && h.level >= 2) category = h.text;
      else if (h.index >= i) break;
    }
    const text = m[3]!;
    out.push({
      category,
      level: m[2]!.toLowerCase() as SkillLevel,
      term: extractTerm(text),
      text,
      lineIndex: i,
      raw: lines[i]!
    });
  }
  return out;
}

export function findSkill(content: string, term: string): Skill | undefined {
  const target = normalize(term);
  return parseSkills(content).find((s) => normalize(s.term) === target);
}

export function listCategories(content: string): string[] {
  return findHeadings(toLines(content))
    .filter((h) => h.level === 2)
    .map((h) => h.text);
}

export interface CategoryMatch {
  /** Cabecera bajo la que hay que escribir. */
  name: string;
  how: "exact" | "prefix" | "new" | "ambiguous";
  candidates?: string[];
}

/**
 * Resuelve la categoria del radar contra las cabeceras reales del perfil.
 *
 * Existe porque el radar usa nombres cortos escritos a mano ("Infrastructure")
 * y el perfil tiene cabeceras largas ("Infrastructure, DevOps and deployment").
 * Sin esto, graduar una skill creaba una categoria paralela y partia el archivo
 * en dos secciones que significan lo mismo.
 */
export function resolveCategory(content: string, category: string): CategoryMatch {
  const cats = listCategories(content);
  const target = normalize(category);
  if (!target) return { name: category, how: "new" };

  const exact = cats.find((c) => normalize(c) === target);
  if (exact) return { name: exact, how: "exact" };

  // "Infrastructure" encaja con "Infrastructure, DevOps and deployment" pero no
  // con "Infrastructures": se exige que el corte caiga en un limite de palabra.
  const byPrefix = cats.filter((c) => {
    const n = normalize(c);
    return n.startsWith(target) && /[\s,:;-]/.test(n.charAt(target.length));
  });
  if (byPrefix.length === 1) return { name: byPrefix[0]!, how: "prefix" };
  if (byPrefix.length > 1) {
    return { name: category, how: "ambiguous", candidates: byPrefix };
  }
  return { name: category, how: "new" };
}

export interface EditResult {
  content: string;
  changed: boolean;
  message: string;
}

/**
 * Cambia SOLO la etiqueta de nivel. El resto de la linea (la nota entre
 * parentesis, la indentacion, el tipo de vinieta) se conserva byte a byte.
 */
export function updateSkillLevel(
  content: string,
  term: string,
  level: SkillLevel
): EditResult {
  const skill = findSkill(content, term);
  if (!skill) {
    return {
      content,
      changed: false,
      message: `"${term}" is not in skills.md. If you just acquired it, use confirm_skill; if you still lack it, it belongs in the gap radar.`
    };
  }
  if (skill.level === level) {
    return { content, changed: false, message: `"${skill.term}" was already [${level}].` };
  }
  const eol = detectEol(content);
  const lines = toLines(content);
  lines[skill.lineIndex] = skill.raw.replace(`[${skill.level}]`, `[${level}]`);
  return {
    content: fromLines(lines, eol),
    changed: true,
    message: `"${skill.term}": [${skill.level}] -> [${level}] in "${skill.category}".`
  };
}

/**
 * Alta de una skill en su categoria. Si la categoria no existe se crea al final
 * del archivo: es preferible una cabecera nueva a colocar la linea en un sitio
 * arbitrario. La evidencia se guarda como nota entre parentesis, que es el
 * formato que ya usan las lineas escritas a mano.
 */
export function addSkill(
  content: string,
  category: string,
  term: string,
  level: SkillLevel,
  evidence?: string
): EditResult {
  const existing = findSkill(content, term);
  if (existing) {
    return {
      content,
      changed: false,
      message: `"${existing.term}" is already in skills.md, under "${existing.category}" as [${existing.level}]. Use update_skill_level to change it.`
    };
  }

  const match = resolveCategory(content, category);
  if (match.how === "ambiguous") {
    return {
      content,
      changed: false,
      message: `Category "${category}" matches several profile sections: ${match.candidates!.join(
        " / "
      )}. Pick one with the category parameter.`
    };
  }

  const eol = detectEol(content);
  let lines = toLines(content);
  const note = evidence && evidence.trim() ? ` (${evidence.trim()})` : "";
  const line = `- [${level}] ${term.trim()}${note}`;

  const section = findSection(lines, match.name, 2);
  if (section) {
    lines = appendToSection(lines, section, [line]);
    const clarification =
      match.how === "prefix" ? ` (the radar category was "${category}")` : "";
    return {
      content: fromLines(lines, eol),
      changed: true,
      message: `"${term}" added to "${section.heading.text}"${clarification} as [${level}].`
    };
  }

  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  lines.push("", `## ${category.trim()}`, line, "");
  return {
    content: fromLines(lines, eol),
    changed: true,
    message: `Category "${category}" did not exist: created at the end of the file. "${term}" added as [${level}].`
  };
}
