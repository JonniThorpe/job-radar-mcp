import * as fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DATA_DIR, paths } from "./config.js";
import {
  assertSafeId,
  checkDataDir,
  readIfExists,
  readRequired,
  today,
  writeAtomic
} from "./lib/files.js";
import { cvSelectionShape, parseCvBase, renderCv } from "./lib/cv.js";
import { confirmSkill } from "./lib/graduate.js";
import {
  addOfferNote,
  buildOffer,
  OFFER_STATUSES,
  replaceAnalysis,
  setFrontmatterField,
  setOfferStatus,
  yamlList
} from "./lib/offers.js";
import { listGaps, recordGap } from "./lib/radar.js";
import { SKILL_LEVELS, updateSkillLevel } from "./lib/skills.js";

/**
 * Tools: acciones CON efectos secundarios que el modelo puede decidir invocar.
 *
 * La descripcion de cada tool y de cada parametro no es documentacion: es el
 * unico contexto que tiene el modelo para decidir cuando y como llamarlo. El
 * esquema Zod valida despues; la descripcion evita la llamada equivocada antes.
 */

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({
  content: [{ type: "text" as const, text }],
  isError: true
});

/**
 * Un fallo esperado (id invalido, archivo que falta) se devuelve como isError
 * con un mensaje accionable. Una excepcion sin capturar solo produce un error
 * opaco en el cliente y el modelo no sabe como corregirse.
 *
 * Antes de nada se comprueba que la boveda existe: writeAtomic crea carpetas, y
 * sin esta guarda un save_offer sobre una ruta mal escrita crearia una boveda
 * nueva en silencio.
 */
function guard(fn: () => { content: { type: "text"; text: string }[]; isError?: boolean }) {
  try {
    if (!fs.existsSync(DATA_DIR)) return fail(checkDataDir(DATA_DIR)!);
    return fn();
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

export function registerTools(server: McpServer): void {
  const p = paths();

  // ---------------------------------------------------------------- radar ---

  server.registerTool(
    "record_gap",
    {
      title: "Record a gap",
      description:
        "Records that a job offer asks for a skill the user does NOT have. If the term is already in the radar its count goes up by one and the source is added; otherwise it is created with count 1. It never duplicates. Call it once per skill the offer asks for that is missing from the user's profile, including terms the user could not define in an interview. Never call it for something already in skills.md.",
      inputSchema: {
        term: z
          .string()
          .min(1)
          .describe("The missing skill or concept, named the way an engineer would. E.g. 'Kubernetes'."),
        category: z
          .string()
          .describe(
            "Category it belongs to, used to place it under the right '##' heading in the profile once it graduates. E.g. 'Infrastructure'."
          ),
        source: z
          .string()
          .describe("Offer that asks for it, so it can be traced. E.g. 'Acme Backend Engineer, Remote'.")
      },
      annotations: { destructiveHint: false, idempotentHint: false }
    },
    async ({ term, category, source }) =>
      guard(() => {
        const content = readRequired(p.radar, "profile/gaps.md");
        const r = recordGap(content, term, category, source);
        if (r.changed) writeAtomic(p.radar, r.content);
        return ok(r.message);
      })
  );

  server.registerTool(
    "list_gaps",
    {
      title: "List gaps",
      description:
        "Returns every gap in the radar sorted by count, highest first: the top entries are what most offers have asked for, and therefore the most urgent to learn.",
      annotations: { readOnlyHint: true }
    },
    async () =>
      guard(() => {
        const gaps = listGaps(readRequired(p.radar, "profile/gaps.md"));
        if (gaps.length === 0) return ok("The radar is empty.");
        const rows = gaps.map(
          (g) =>
            `| ${g.counter} | ${g.term} | ${g.category ?? "-"} | ${g.sources.join("; ") || "-"} |`
        );
        return ok(
          [
            `${gaps.length} gap(s), most urgent first:`,
            "",
            "| Count | Term | Category | Sources |",
            "| --- | --- | --- | --- |",
            ...rows
          ].join("\n")
        );
      })
  );

  server.registerTool(
    "confirm_skill",
    {
      title: "Graduate a skill",
      description:
        "Graduation: confirms the user now has a skill that was in the radar. Removes it from gaps.md and adds it to skills.md with its level and evidence. It is the ONLY path from gap to profile. Use it only when the user confirms they have acquired it (certification, project or real experience), never on your own initiative.",
      inputSchema: {
        term: z.string().min(1).describe("Term exactly as it appears in the radar."),
        level: z
          .enum(SKILL_LEVELS)
          .describe(
            "solid = can defend it in an interview with evidence from a project. partial = has used it, does not master it."
          ),
        evidence: z
          .string()
          .min(1)
          .describe(
            "Why the user can defend it: certification, project or experience. Stored in the profile as a note. The offer that created the gap is NOT kept."
          ),
        category: z
          .string()
          .optional()
          .describe("Only if the gap had no category in the radar.")
      },
      annotations: { destructiveHint: false, idempotentHint: false }
    },
    async ({ term, level, evidence, category }) =>
      guard(() => {
        const radar = readRequired(p.radar, "profile/gaps.md");
        const skills = readRequired(p.skills, "profile/skills.md");
        const r = confirmSkill(radar, skills, term, level, evidence, category);
        if (!r.ok) return fail(r.message);
        // Todas las comprobaciones se hacen antes de escribir. Son dos
        // escrituras atomicas seguidas, no una transaccion: si fallara la
        // segunda, el radar ya estaria actualizado y el perfil no.
        writeAtomic(p.radar, r.radar);
        writeAtomic(p.skills, r.skills);
        return ok(r.message);
      })
  );

  // -------------------------------------------------------------- profile ---

  server.registerTool(
    "update_skill_level",
    {
      title: "Change a skill level",
      description:
        "Changes the level of a term that is ALREADY in skills.md. For something that is not in the profile yet, use confirm_skill.",
      inputSchema: {
        term: z.string().min(1).describe("Term exactly as it appears in skills.md."),
        level: z.enum(SKILL_LEVELS).describe("New level: solid or partial.")
      },
      annotations: { destructiveHint: false, idempotentHint: true }
    },
    async ({ term, level }) =>
      guard(() => {
        const content = readRequired(p.skills, "profile/skills.md");
        const r = updateSkillLevel(content, term, level);
        if (r.changed) {
          writeAtomic(p.skills, r.content);
          return ok(r.message);
        }
        // Mismo nivel que ya tenia: no es un error, igual que set_offer_status.
        return r.message.includes("was already") ? ok(r.message) : fail(r.message);
      })
  );

  // --------------------------------------------------------------- offers ---

  server.registerTool(
    "save_offer",
    {
      title: "Save an offer analysis",
      description:
        "Creates or updates an offer file with its analysis. If the offer already exists ONLY the analysis is replaced: status and interview notes are kept.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("Identifier and file name, format YYYY-MM-company. E.g. '2026-07-acme'."),
        title: z.string().min(1).describe("Job title exactly as the offer states it."),
        company: z.string().min(1).describe("Company."),
        markdown: z
          .string()
          .min(1)
          .describe("The full analysis in Markdown, with the six points of the template."),
        score: z
          .number()
          .int()
          .min(0)
          .max(100)
          .optional()
          .describe("Score following the scoring rules in criteria.md, if it defines any."),
        salary: z.string().optional().describe("Range or figure exactly as the offer publishes it."),
        url: z.string().optional().describe("Link to the original offer."),
        tags: z.array(z.string()).optional().describe("Short labels. E.g. ['backend','remote'].")
      },
      annotations: { destructiveHint: false, idempotentHint: true }
    },
    async ({ id, title, company, markdown, score, salary, url, tags }) =>
      guard(() => {
        const safe = assertSafeId(id);
        const file = p.offer(safe);
        const date = today();
        const existing = readIfExists(file);

        if (existing === undefined) {
          writeAtomic(
            file,
            buildOffer({ id: safe, title, company, markdown, date, score, salary, url, tags })
          );
          return ok(`Offer "${safe}" created at offers/${safe}.md with status "analyzed".`);
        }

        const replaced = replaceAnalysis(existing, markdown, date);
        if (!replaced.changed) return fail(`${safe}: ${replaced.message}`);
        let content = replaced.content;
        content = setFrontmatterField(content, "title", title);
        content = setFrontmatterField(content, "company", company);
        if (score !== undefined) content = setFrontmatterField(content, "score", String(score));
        if (salary !== undefined) content = setFrontmatterField(content, "salary", salary);
        if (url !== undefined) content = setFrontmatterField(content, "url", url);
        if (tags !== undefined) content = setFrontmatterField(content, "tags", yamlList(tags), true);
        writeAtomic(file, content);
        return ok(`Offer "${safe}" updated: analysis replaced, status and interview notes kept.`);
      })
  );

  server.registerTool(
    "set_offer_status",
    {
      title: "Change an offer status",
      description:
        "Moves an offer along its lifecycle and logs the change with a date. Lifecycle: analyzed -> applied -> interview -> offer -> accepted. Side exits from any point: rejected (the company says no) and discarded (the user decides to stop).",
      inputSchema: {
        id: z.string().min(1).describe("Offer id. E.g. '2026-07-acme'."),
        status: z.enum(OFFER_STATUSES).describe("New status, one of the seven in the lifecycle.")
      },
      annotations: { destructiveHint: false, idempotentHint: true }
    },
    async ({ id, status }) =>
      guard(() => {
        const safe = assertSafeId(id);
        const file = p.offer(safe);
        const content = readIfExists(file);
        if (content === undefined) return fail(`There is no offer "${safe}" in offers/.`);
        const r = setOfferStatus(content, status, today());
        if (!r.changed) return ok(r.message);
        writeAtomic(file, r.content);
        return ok(`${safe}: ${r.message}`);
      })
  );

  server.registerTool(
    "add_offer_note",
    {
      title: "Add a note to an offer",
      description:
        "Adds a dated note to the 'Interview notes' section of an offer: who interviewed the user, what they asked, feedback received, or anything worth rereading before the next round. Notes accumulate, they are never overwritten.",
      inputSchema: {
        id: z.string().min(1).describe("Offer id."),
        note: z.string().min(1).describe("Note text. Multiple lines and Markdown are fine.")
      },
      annotations: { destructiveHint: false, idempotentHint: false }
    },
    async ({ id, note }) =>
      guard(() => {
        const safe = assertSafeId(id);
        const file = p.offer(safe);
        const content = readIfExists(file);
        if (content === undefined) return fail(`There is no offer "${safe}" in offers/.`);
        const r = addOfferNote(content, note, today());
        if (!r.changed) return fail(r.message);
        writeAtomic(file, r.content);
        return ok(`${safe}: ${r.message}`);
      })
  );

  // ------------------------------------------------------------------- cv ---

  server.registerTool(
    "render_cv",
    {
      title: "Render a CV tailored to an offer",
      description:
        "Writes output/cv-<id>.html, a version of the CV tailored to one offer: it chooses which projects, which lines of each project, which bullets and which tags go in, and in what order. If not everything fits, trim lines inside each project before dropping a whole project. It CANNOT invent content: everything must already exist in profile/cv-data.json, and the whole call fails if you cite an id or tag that is not there. Only headline, summary and location accept free text, because they are framing. Omit any section to keep it complete as is. Do NOT call it on your own after an analysis: propose the tailoring and wait for the user to ask for it.",
      inputSchema: cvSelectionShape,
      annotations: { destructiveHint: true, idempotentHint: true }
    },
    async (selection) =>
      guard(() => {
        const safe = assertSafeId(selection.offerId);
        const base = parseCvBase(readRequired(p.cvData, "profile/cv-data.json"));
        const template = readRequired(p.cvTemplate, "templates/cv.html");
        const r = renderCv(base, { ...selection, offerId: safe }, template, today());

        writeAtomic(p.cvOut(safe), r.html);

        return ok(
          [
            `Tailored CV written to output/cv-${safe}.html.`,
            `Estimated fill: sidebar ${r.usoSidebar.toFixed(0)}%, main column ${r.usoMain.toFixed(0)}%.`,
            ...(r.avisos.length > 0 ? ["", ...r.avisos.map((a) => `WARNING: ${a}`)] : []),
            "",
            "Open it in a browser and print it to PDF (A4, no margins)."
          ].join("\n")
        );
      })
  );

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description:
        "Checks that the server is alive and which data folder it is working on.",
      annotations: { readOnlyHint: true }
    },
    async () => {
      const problem = checkDataDir(DATA_DIR);
      return problem
        ? fail(`pong, but there is a problem.\n\n${problem}`)
        : ok(`pong. Data dir: ${DATA_DIR}. ${new Date().toISOString()}`);
    }
  );
}
