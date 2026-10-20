import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

/**
 * Las plantillas son codigo del servidor, no datos: viven en el repo y NO en la
 * boveda. Se resuelven desde este modulo (build/config.js) para que el servidor
 * funcione se lance desde donde se lance.
 */
export const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url));

/** Raiz del repo: de aqui cuelga example-vault/, que usan los tests. */
export const REPO_DIR = fileURLToPath(new URL("../", import.meta.url));

/** Carpeta por defecto si no se define JOB_MCP_DATA_DIR. */
export const DEFAULT_DATA_DIR = path.join(os.homedir(), "job-radar-vault");

/**
 * Raiz de los datos. Se recomienda definir JOB_MCP_DATA_DIR siempre; si no, se
 * usa ~/job-radar-vault. Un valor vacio cuenta como no definido.
 */
export const DATA_DIR = process.env.JOB_MCP_DATA_DIR?.trim() || DEFAULT_DATA_DIR;

export function paths(dataDir: string = DATA_DIR) {
  return {
    dataDir,
    profileDir: path.join(dataDir, "profile"),
    offersDir: path.join(dataDir, "offers"),
    skills: path.join(dataDir, "profile", "skills.md"),
    radar: path.join(dataDir, "profile", "gaps.md"),
    criteria: path.join(dataDir, "profile", "criteria.md"),
    cv: path.join(dataDir, "profile", "cv.md"),
    cvData: path.join(dataDir, "profile", "cv-data.json"),
    offer: (id: string) => path.join(dataDir, "offers", `${id}.md`),
    // Las salidas generadas van aparte de las fuentes: nada de lo que hay en
    // output/ se edita a mano, se regenera.
    outputDir: path.join(dataDir, "output"),
    cvOut: (id: string) => path.join(dataDir, "output", `cv-${id}.html`),
    cvTemplate: path.join(TEMPLATES_DIR, "cv.html")
  };
}
