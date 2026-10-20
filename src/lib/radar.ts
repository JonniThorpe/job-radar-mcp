import {
  appendToSection,
  detectEol,
  findHeadings,
  findSection,
  fromLines,
  normalize,
  toLines
} from "./markdown.js";

/**
 * gaps.md es lo que el mercado pide y no tengo. Cada termino lleva un contador
 * de cuantas ofertas objetivo lo han pedido: la demanda repetida es la senal
 * de prioridad.
 */

export const CONFIRMED_SECTION = "Confirmed by offers";
export const WATCHLIST_SECTION = "Watchlist";
export const SOURCES_SECTION = "Tracked sources";

/**
 * Separador de fuentes. Es ';' y no ',' porque las fuentes reales llevan comas
 * dentro ("Acme Backend Engineer, Remote"): con coma no habria forma de saber
 * si son una fuente o dos.
 */
export const SOURCE_SEPARATOR = "; ";

export interface Gap {
  counter: number;
  /** Termino sin la categoria entre parentesis. */
  term: string;
  category?: string;
  sources: string[];
  /** Cabecera bajo la que vive la linea. */
  section: string;
  lineIndex: number;
  raw: string;
}

// '- [count: 2] Kubernetes (Infrastructure). Sources: X; Y'
const GAP_RE = /^(\s*[-*]\s+)\[count:\s*(\d+)\]\s*(.+?)\s*$/i;

function parseRest(rest: string): Pick<Gap, "term" | "category" | "sources"> {
  let head = rest;
  let sources: string[] = [];

  const idx = rest.search(/Sources\s*:/i);
  if (idx !== -1) {
    head = rest.slice(0, idx).replace(/\s*\.?\s*$/, "");
    sources = rest
      .slice(idx)
      .replace(/^Sources\s*:\s*/i, "")
      .replace(/\s*\.\s*$/, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  let term = head.replace(/\s*\.\s*$/, "").trim();
  let category: string | undefined;
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(term);
  if (m) {
    term = m[1]!.trim();
    category = m[2]!.trim();
  }
  return { term, category, sources };
}

export function parseGaps(content: string): Gap[] {
  const lines = toLines(content);
  const headings = findHeadings(lines);
  const out: Gap[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = GAP_RE.exec(lines[i]!);
    // Las vinietas de '## Rules' no llevan [count: N] y por eso no entran
    // aqui. El discriminador es el patron, nunca la posicion en el archivo.
    if (!m) continue;
    let section = "";
    for (const h of headings) {
      if (h.index < i && h.level >= 2) section = h.text;
      else if (h.index >= i) break;
    }
    out.push({
      counter: Number(m[2]),
      section,
      lineIndex: i,
      raw: lines[i]!,
      ...parseRest(m[3]!)
    });
  }
  return out;
}

const byCounter = (a: Gap, b: Gap) => b.counter - a.counter || a.term.localeCompare(b.term, "en");

/** Huecos ordenados por contador descendente; a igual contador, alfabetico. */
export function listGaps(content: string): Gap[] {
  return parseGaps(content)
    .filter((g) => normalize(g.section) !== normalize(SOURCES_SECTION))
    .sort(byCounter);
}

export function findGap(content: string, term: string): Gap | undefined {
  const target = normalize(term);
  return parseGaps(content).find(
    (g) => normalize(g.term) === target && normalize(g.section) !== normalize(SOURCES_SECTION)
  );
}

/**
 * Reordena por contador descendente SOLO las lineas de hueco de una seccion,
 * reutilizando sus mismos indices. Las lineas que no son huecos (prosa, blancos)
 * se quedan donde estaban.
 */
function sortSectionLines(lines: string[], sectionName: string): string[] {
  const gaps = parseGaps(fromLines(lines, "\n")).filter(
    (g) => normalize(g.section) === normalize(sectionName)
  );
  if (gaps.length < 2) return lines;

  const indices = gaps.map((g) => g.lineIndex);
  const ordered = gaps.slice().sort(byCounter).map((g) => g.raw);

  const out = lines.slice();
  indices.forEach((lineIndex, position) => {
    out[lineIndex] = ordered[position]!;
  });
  return out;
}

/**
 * Devuelve el radar con las lineas de hueco ordenadas por contador dentro de
 * cada seccion, SIN escribir en disco. Lo usa el resource profile://gaps para
 * garantizar el orden aunque el archivo se haya editado a mano.
 */
export function sortRadar(content: string): string {
  const eol = detectEol(content);
  let lines = toLines(content);
  const sections = [...new Set(parseGaps(content).map((g) => g.section))];
  for (const section of sections) lines = sortSectionLines(lines, section);
  return fromLines(lines, eol);
}

export interface RadarResult {
  content: string;
  changed: boolean;
  message: string;
  counter?: number;
}

/**
 * Corazon del sistema. Si el termino existe sube su contador en uno y anade la
 * fuente; si no, lo crea con contador 1. Nunca duplica.
 *
 * La linea existente se edita por sustitucion de texto, no se regenera: asi se
 * conserva su formato original (puntuacion, categoria escrita a mano, orden de
 * las fuentes previas).
 */
export function recordGap(
  content: string,
  term: string,
  category: string,
  source: string
): RadarResult {
  const eol = detectEol(content);
  let lines = toLines(content);
  const existing = findGap(content, term);
  const src = source.trim();

  if (existing) {
    const next = existing.counter + 1;
    let raw = existing.raw.replace(/\[count:\s*\d+\]/i, `[count: ${next}]`);

    const alreadyThere = existing.sources.some((s) => normalize(s) === normalize(src));
    if (src && !alreadyThere) {
      if (existing.sources.length > 0) {
        raw = raw.replace(/\s*\.?\s*$/, "") + `${SOURCE_SEPARATOR}${src}`;
      } else {
        raw = raw.replace(/\s*\.?\s*$/, "") + `. Sources: ${src}`;
      }
    }

    lines[existing.lineIndex] = raw;
    lines = sortSectionLines(lines, existing.section);

    const note =
      normalize(existing.section) === normalize(WATCHLIST_SECTION)
        ? ` It stays in "${WATCHLIST_SECTION}".`
        : "";
    return {
      content: bumpSource(fromLines(lines, eol), src),
      changed: true,
      counter: next,
      message: `"${existing.term}": count ${existing.counter} -> ${next}.${note}${
        alreadyThere ? ` Source "${src}" was already listed.` : ""
      }`
    };
  }

  const cat = category.trim() ? ` (${category.trim()})` : "";
  const sources = src ? `. Sources: ${src}` : "";
  const line = `- [count: 1] ${term.trim()}${cat}${sources}`;

  const section = findSection(lines, CONFIRMED_SECTION, 2);
  if (section) {
    lines = appendToSection(lines, section, [line]);
    lines = sortSectionLines(lines, CONFIRMED_SECTION);
  } else {
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
    lines.push("", `## ${CONFIRMED_SECTION}`, line, "");
  }

  return {
    content: bumpSource(fromLines(lines, eol), src),
    changed: true,
    counter: 1,
    message: `"${term}" is new in the radar: created with count 1 in "${CONFIRMED_SECTION}".`
  };
}

/**
 * Contador por fuente en '## Tracked sources'. Cuenta cuantos huecos ha
 * destapado cada oferta: un numero alto significa "esta oferta pide muchas
 * cosas que no tengo".
 */
function bumpSource(content: string, source: string): string {
  if (!source) return content;
  const eol = detectEol(content);
  let lines = toLines(content);
  const section = findSection(lines, SOURCES_SECTION, 2);
  if (!section) return content;

  for (let i = section.start; i < section.end; i++) {
    const m = GAP_RE.exec(lines[i]!);
    if (!m) continue;
    const { term } = parseRest(m[3]!);
    if (normalize(term) === normalize(source)) {
      lines[i] = lines[i]!.replace(/\[count:\s*\d+\]/i, `[count: ${Number(m[2]) + 1}]`);
      return fromLines(sortSectionLines(lines, SOURCES_SECTION), eol);
    }
  }

  lines = appendToSection(lines, section, [`- [count: 1] ${source}`]);
  return fromLines(sortSectionLines(lines, SOURCES_SECTION), eol);
}

/**
 * Saca un termino del radar. Se usa en la graduacion (confirm_skill): la linea
 * desaparece de aqui entera, incluidas sus fuentes, que NO viajan al perfil.
 */
export function removeGap(content: string, term: string): RadarResult & { gap?: Gap } {
  const gap = findGap(content, term);
  if (!gap) {
    return {
      content,
      changed: false,
      message: `"${term}" is not in the gap radar.`
    };
  }
  const eol = detectEol(content);
  const lines = toLines(content);
  lines.splice(gap.lineIndex, 1);
  return {
    content: fromLines(lines, eol),
    changed: true,
    gap,
    message: `"${gap.term}" removed from the radar (count was ${gap.counter}).`
  };
}
