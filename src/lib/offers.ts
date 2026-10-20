import {
  appendToSection,
  detectEol,
  findHeadings,
  findSection,
  fromLines,
  normalize,
  toLines
} from "./markdown.js";

/** Ciclo de vida de una oferta. El servidor valida contra esta lista. */
export const OFFER_STATUSES = [
  "analyzed",
  "applied",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "discarded"
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export function isOfferStatus(value: string): value is OfferStatus {
  return (OFFER_STATUSES as readonly string[]).includes(value);
}

// La comparacion usa normalize(), que ignora mayusculas y acentos, asi que una
// cabecera escrita a mano con otra capitalizacion tambien casa.
export const ANALYSIS_SECTION = "Analysis";
export const STATUS_LOG_SECTION = "Status log";
export const NOTES_SECTION = "Interview notes";

export interface Frontmatter {
  [key: string]: string;
}

/**
 * Frontmatter YAML plano (clave: valor). No metemos un parser de YAML entero
 * porque el formato que escribimos es de una sola profundidad, y una dependencia
 * menos es una dependencia menos que mantener.
 */
export function parseFrontmatter(content: string): {
  data: Frontmatter;
  bodyStart: number;
} {
  const lines = toLines(content);
  if (lines[0]?.trim() !== "---") return { data: {}, bodyStart: 0 };
  const data: Frontmatter = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === "---") return { data, bodyStart: i + 1 };
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[i]!);
    if (m) data[m[1]!] = m[2]!.trim().replace(/^["'](.*)["']$/, "$1");
  }
  return { data, bodyStart: 0 };
}

/** Escapa solo lo imprescindible para que el YAML siga siendo valido. */
export function yamlValue(value: string): string {
  const v = value.trim();
  return /^[\w][\w .,:;/&+()-]*$/u.test(v) && !v.includes(": ") ? v : JSON.stringify(v);
}

/** Lista inline de YAML: 'tags: [backend, ml]', que es lo que Obsidian indexa. */
export function yamlList(values: string[]): string {
  return `[${values.map((t) => t.trim()).filter(Boolean).join(", ")}]`;
}

/**
 * Escribe una clave del frontmatter. `raw` es para valores que YA vienen
 * serializados (una lista inline): pasarlos por yamlValue los convertiria en
 * un string citado y Dataview dejaria de verlos como lista.
 */
export function setFrontmatterField(
  content: string,
  key: string,
  value: string,
  raw = false
): string {
  const eol = detectEol(content);
  const lines = toLines(content);
  const { bodyStart } = parseFrontmatter(content);
  if (bodyStart === 0) return content;

  const serialized = `${key}: ${raw ? value : yamlValue(value)}`;
  for (let i = 1; i < bodyStart - 1; i++) {
    if (new RegExp(`^${key}\\s*:`).test(lines[i]!)) {
      lines[i] = serialized;
      return fromLines(lines, eol);
    }
  }
  lines.splice(bodyStart - 1, 0, serialized);
  return fromLines(lines, eol);
}

export interface BuildOfferInput {
  id: string;
  title: string;
  company: string;
  markdown: string;
  status?: OfferStatus;
  date: string;
  /** Rango o cifra tal y como lo publica la oferta. Es un dato, nunca un motivo para descartar. */
  salary?: string;
  /** Puntuacion segun los ejes de criteria.md. */
  score?: number;
  url?: string;
  tags?: string[];
}

/**
 * Estructura fija: frontmatter para que Dataview y Kanban lo lean, y tres
 * secciones que el resto de tools saben localizar por nombre.
 *
 * Los campos opcionales se escriben SIEMPRE, aunque vengan vacios: una clave
 * presente y vacia se rellena luego a mano en Obsidian, mientras que una clave
 * ausente hay que recordar como se llamaba.
 */
export function buildOffer(input: BuildOfferInput): string {
  const status = input.status ?? "analyzed";
  return [
    "---",
    `id: ${yamlValue(input.id)}`,
    `title: ${yamlValue(input.title)}`,
    `company: ${yamlValue(input.company)}`,
    `status: ${status}`,
    `score: ${input.score ?? ""}`,
    `salary: ${input.salary ? yamlValue(input.salary) : ""}`,
    `url: ${input.url ? yamlValue(input.url) : ""}`,
    `tags: ${yamlList(input.tags ?? [])}`,
    `created: ${input.date}`,
    `updated: ${input.date}`,
    "---",
    "",
    `# ${input.title} - ${input.company}`,
    "",
    `## ${ANALYSIS_SECTION}`,
    "",
    input.markdown.trim(),
    "",
    `## ${STATUS_LOG_SECTION}`,
    `- ${input.date}: ${status}`,
    "",
    `## ${NOTES_SECTION}`,
    ""
  ].join("\n");
}

/**
 * Limites de la seccion de analisis.
 *
 * No sirve "hasta la siguiente cabecera de nivel 2": el analisis trae sus
 * PROPIAS cabeceras (los puntos de la plantilla) y cortariamos en la primera.
 * El analisis termina donde empieza la siguiente seccion FIJA conocida.
 */
function analysisRange(lines: string[]): { start: number; end: number } | undefined {
  const headings = findHeadings(lines);
  const start = headings.find(
    (h) => h.level === 2 && normalize(h.text) === normalize(ANALYSIS_SECTION)
  );
  if (!start) return undefined;

  const fixed = [STATUS_LOG_SECTION, NOTES_SECTION].map(normalize);
  const end = headings.find(
    (h) => h.level === 2 && h.index > start.index && fixed.includes(normalize(h.text))
  );
  return { start: start.index + 1, end: end ? end.index : lines.length };
}

export interface OfferEditResult {
  content: string;
  changed: boolean;
  message: string;
}

/**
 * Conserva estado y notas al reguardar una oferta ya existente: solo se
 * reemplaza la seccion de analisis y se refresca 'updated'. Si el archivo no
 * tiene seccion de analisis (alguien la renombro a mano) NO se toca nada y se
 * dice, en vez de responder "actualizado" sin haberlo hecho.
 */
export function replaceAnalysis(
  content: string,
  markdown: string,
  date: string
): OfferEditResult {
  const eol = detectEol(content);
  const lines = toLines(content);
  const range = analysisRange(lines);
  if (!range) {
    return {
      content,
      changed: false,
      message: `The offer file has no "## ${ANALYSIS_SECTION}" heading, so the analysis was not replaced. Add that heading back (or rename it) and save again.`
    };
  }

  const fresh = ["", ...markdown.trim().split(/\r?\n/), ""];
  const out = lines.slice(0, range.start).concat(fresh, lines.slice(range.end));
  return {
    content: setFrontmatterField(fromLines(out, eol), "updated", date),
    changed: true,
    message: "Analysis replaced."
  };
}

export function setOfferStatus(
  content: string,
  status: OfferStatus,
  date: string
): OfferEditResult {
  const { data } = parseFrontmatter(content);
  const previous = data.status ?? "(no status)";
  if (previous === status) {
    return { content, changed: false, message: `The offer was already "${status}".` };
  }

  let next = setFrontmatterField(content, "status", status);
  next = setFrontmatterField(next, "updated", date);

  const eol = detectEol(next);
  let lines = toLines(next);
  const section = findSection(lines, STATUS_LOG_SECTION, 2);
  const entry = `- ${date}: ${previous} -> ${status}`;

  if (section) {
    lines = appendToSection(lines, section, [entry]);
  } else {
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
    lines.push("", `## ${STATUS_LOG_SECTION}`, entry, "");
  }

  return {
    content: fromLines(lines, eol),
    changed: true,
    message: `Status: ${previous} -> ${status}.`
  };
}

export function addOfferNote(
  content: string,
  note: string,
  date: string
): OfferEditResult {
  const text = note.trim();
  if (!text) return { content, changed: false, message: "The note is empty." };

  const eol = detectEol(content);
  let lines = toLines(content);
  // Cabecera de nivel 3 con la fecha: permite notas de varias lineas y las deja
  // plegables en Obsidian.
  const block = ["", `### ${date}`, "", ...text.split(/\r?\n/)];

  const section = findSection(lines, NOTES_SECTION, 2);
  if (section) {
    lines = appendToSection(lines, section, block);
  } else {
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
    lines.push("", `## ${NOTES_SECTION}`, ...block, "");
  }

  return {
    content: setFrontmatterField(fromLines(lines, eol), "updated", date),
    changed: true,
    message: `Dated note ${date} added.`
  };
}
