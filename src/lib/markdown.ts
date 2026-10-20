/**
 * Utilidades de Markdown orientadas a LINEA, no a arbol sintactico.
 *
 * La regla de toda esta capa: no reconstruimos el documento a partir de un
 * modelo. Parseamos solo lo que reconocemos y editamos esa linea concreta,
 * dejando intacto el resto del archivo (prosa, secciones ajenas, formato del
 * usuario). Estos archivos los edita tambien un humano en Obsidian.
 */

/** Detecta el fin de linea dominante para no meter ruido en los diffs. */
export function detectEol(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

export function toLines(content: string): string[] {
  return content.split(/\r?\n/);
}

export function fromLines(lines: string[], eol: string): string {
  return lines.join(eol);
}

export interface Heading {
  /** Texto de la cabecera sin los '#'. */
  text: string;
  /** Numero de '#'. */
  level: number;
  /** Indice de la linea de la cabecera. */
  index: number;
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*$/;

export function findHeadings(lines: string[]): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING_RE.exec(line);
    if (m) out.push({ level: m[1]!.length, text: m[2]!, index: i });
  }
  return out;
}

// Marcas diacriticas combinantes (Unicode NFD). Escrito con escapes para que el
// fichero fuente siga siendo ASCII puro en esta parte.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Comparacion de cabeceras y terminos: sin mayusculas, sin acentos, sin espacio sobrante. */
export function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase().trim();
}

export interface SectionRange {
  heading: Heading;
  /** Primera linea de contenido (justo despues de la cabecera). */
  start: number;
  /** Linea siguiente al final del contenido (exclusivo). */
  end: number;
}

/**
 * Rango de una seccion: desde su cabecera hasta la siguiente cabecera de nivel
 * igual o superior. Devuelve undefined si no existe.
 */
export function findSection(
  lines: string[],
  headingText: string,
  level?: number
): SectionRange | undefined {
  const headings = findHeadings(lines);
  const target = normalize(headingText);
  const pos = headings.findIndex(
    (h) => normalize(h.text) === target && (level === undefined || h.level === level)
  );
  if (pos === -1) return undefined;
  const heading = headings[pos]!;
  const next = headings.slice(pos + 1).find((h) => h.level <= heading.level);
  return {
    heading,
    start: heading.index + 1,
    end: next ? next.index : lines.length
  };
}

/** Seccion que contiene una linea dada, si la hay. */
export function sectionOfLine(lines: string[], lineIndex: number): Heading | undefined {
  const headings = findHeadings(lines);
  let current: Heading | undefined;
  for (const h of headings) {
    if (h.index < lineIndex) current = h;
    else break;
  }
  return current;
}

/**
 * Inserta lineas al final del contenido de una seccion, por delante de las
 * lineas en blanco de cola, para no ir dejando huecos crecientes.
 */
export function appendToSection(
  lines: string[],
  section: SectionRange,
  newLines: string[]
): string[] {
  let insertAt = section.end;
  while (insertAt > section.start && lines[insertAt - 1]!.trim() === "") insertAt--;
  const out = lines.slice();
  out.splice(insertAt, 0, ...newLines);
  return out;
}
