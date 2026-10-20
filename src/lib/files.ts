import * as fs from "node:fs";
import * as path from "node:path";
import { paths } from "../config.js";
import { parseFrontmatter } from "./offers.js";

/** Todo el I/O concentrado aqui: el resto de modulos son funciones puras. */

/**
 * Comprueba que la boveda existe. Devuelve un mensaje accionable si falta, o
 * undefined si todo esta en su sitio. Nunca crea la carpeta raiz: eso lo decide
 * el usuario. Si la raiz existe, si se crean profile/ y offers/ cuando faltan.
 */
export function checkDataDir(dataDir: string): string | undefined {
  if (!fs.existsSync(dataDir)) {
    return [
      `job-radar-mcp: the data folder does not exist: ${dataDir}`,
      "",
      "Create it by copying the example vault that ships with the repo (run from the repo folder):",
      `  macOS / Linux:  cp -r example-vault "${dataDir}"`,
      `  PowerShell:     Copy-Item -Recurse example-vault "${dataDir}"`,
      "or point the server to your own vault with the JOB_MCP_DATA_DIR environment variable.",
      "The server keeps running, but every tool will fail until the folder exists."
    ].join("\n");
  }
  const p = paths(dataDir);
  fs.mkdirSync(p.profileDir, { recursive: true });
  fs.mkdirSync(p.offersDir, { recursive: true });
  return undefined;
}

export function readIfExists(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export function readRequired(file: string, label: string): string {
  const content = readIfExists(file);
  if (content === undefined) {
    throw new Error(
      `${label} not found at ${file}. Check that JOB_MCP_DATA_DIR points to your vault (you can start from example-vault/).`
    );
  }
  return content;
}

/** Escritura atomica: fichero temporal + rename, para no dejar un .md a medias. */
export function writeAtomic(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

/** El id es nombre de archivo: se restringe para no poder salir de offers/. */
export function assertSafeId(id: string): string {
  const clean = id.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(clean) || /^\.+$/.test(clean)) {
    throw new Error(
      `Invalid offer id: "${id}". Use only letters, digits, hyphen, underscore and dot (e.g. 2026-07-acme).`
    );
  }
  return clean;
}

export interface OfferSummary {
  id: string;
  file: string;
  title: string;
  company: string;
  status: string;
  updated: string;
  score: string;
}

export function listOffers(dataDir: string): OfferSummary[] {
  const dir = paths(dataDir).offersDir;
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".md"));
  } catch {
    return [];
  }

  return files
    .map((f) => {
      const content = readIfExists(path.join(dir, f)) ?? "";
      const { data } = parseFrontmatter(content);
      return {
        id: data.id ?? path.basename(f, ".md"),
        file: f,
        title: data.title ?? "(no title)",
        company: data.company ?? "(no company)",
        status: data.status ?? "(no status)",
        updated: data.updated ?? "",
        score: data.score ?? ""
      };
    })
    .sort((a, b) => b.updated.localeCompare(a.updated) || a.id.localeCompare(b.id));
}

/** Fecha local en ISO corto. Se inyecta en las funciones puras para poder testear. */
export function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
