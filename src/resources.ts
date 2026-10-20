import {
  McpServer,
  ResourceTemplate
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATA_DIR, paths } from "./config.js";
import { assertSafeId, listOffers, readIfExists } from "./lib/files.js";
import { sortRadar } from "./lib/radar.js";

/**
 * Resources: contexto de SOLO LECTURA identificado por URI.
 *
 * A diferencia de un tool, un resource no lo invoca el modelo por su cuenta: lo
 * adjunta el usuario. Por eso no tienen esquema de entrada ni efectos
 * secundarios. Si algo escribe, es un tool aunque devuelva datos.
 */

const MD = "text/markdown";

function textResource(uri: string, text: string) {
  return { contents: [{ uri, mimeType: MD, text }] };
}

/** Un archivo que falta no es un crash: es un mensaje que explica que hacer. */
function fileOrHint(uri: string, file: string, label: string) {
  const content = readIfExists(file);
  if (content === undefined) {
    return textResource(
      uri,
      `${label} does not exist yet.\n\nExpected at:\n  ${file}\n\n` +
        `Check that JOB_MCP_DATA_DIR points to your vault (currently: ${DATA_DIR}). ` +
        `You can start from the example-vault/ folder in the repo.`
    );
  }
  return textResource(uri, content);
}

export function registerResources(server: McpServer): void {
  const p = paths();

  server.registerResource(
    "skills",
    "profile://skills",
    {
      title: "Skills profile",
      description:
        "What the user ALREADY has, by category, at level [solid] or [partial]. It never contains gaps.",
      mimeType: MD
    },
    async (uri) => fileOrHint(uri.href, p.skills, "profile/skills.md")
  );

  server.registerResource(
    "gaps",
    "profile://gaps",
    {
      title: "Gap radar",
      description:
        "What the market asks for and the user does NOT have, with a count of how many offers asked for it, sorted from most to least urgent.",
      mimeType: MD
    },
    async (uri) => {
      const content = readIfExists(p.radar);
      if (content === undefined) return fileOrHint(uri.href, p.radar, "profile/gaps.md");
      // El orden se garantiza al servir, no solo al escribir: si el archivo se
      // ha editado a mano, el resource lo devuelve ordenado igualmente.
      return textResource(uri.href, sortRadar(content));
    }
  );

  server.registerResource(
    "cv",
    "profile://cv",
    {
      title: "CV",
      description:
        "The user's CV in Markdown: experience and projects with their context and stack. It is the source of concrete evidence to cite when analysing an offer.",
      mimeType: MD
    },
    async (uri) => fileOrHint(uri.href, p.cv, "profile/cv.md")
  );

  server.registerResource(
    "cv-data",
    "profile://cv-data",
    {
      title: "CV catalogue",
      description:
        "The CV content split into ids: every bullet, tag and project on its own. It is the only thing render_cv can choose from, so read it to see what is available before tailoring a CV.",
      mimeType: "application/json"
    },
    async (uri) => {
      const content = readIfExists(p.cvData);
      if (content === undefined) return fileOrHint(uri.href, p.cvData, "profile/cv-data.json");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: content }] };
    }
  );

  server.registerResource(
    "criteria",
    "profile://criteria",
    {
      title: "Decision criteria",
      description:
        "The user's career goal, deal-breakers and scoring axes: what makes an offer worth the time.",
      mimeType: MD
    },
    async (uri) => fileOrHint(uri.href, p.criteria, "profile/criteria.md")
  );

  server.registerResource(
    "offers",
    "offers://list",
    {
      title: "Offer pipeline",
      description:
        "Every analysed offer with its current status, to see the pipeline at a glance.",
      mimeType: MD
    },
    async (uri) => {
      const offers = listOffers(DATA_DIR);
      if (offers.length === 0) {
        return textResource(
          uri.href,
          `# Offer pipeline\n\nNo offers analysed yet in ${p.offersDir}.`
        );
      }
      const rows = offers.map(
        (o) =>
          `| ${o.status} | ${o.company} | ${o.title} | ${o.score || "-"} | ${o.updated || "-"} | \`${o.id}\` |`
      );
      return textResource(
        uri.href,
        [
          "# Offer pipeline",
          "",
          `${offers.length} offer(s). Read \`offers://{id}\` for the details of one.`,
          "",
          "| Status | Company | Title | Score | Updated | Id |",
          "| --- | --- | --- | --- | --- | --- |",
          ...rows
        ].join("\n")
      );
    }
  );

  // Resource dinamico: una URI por oferta. El `list` enumera las existentes para
  // que el cliente pueda ofrecerlas sin que el usuario recuerde los ids.
  server.registerResource(
    "offer",
    new ResourceTemplate("offers://{id}", {
      list: async () => ({
        resources: listOffers(DATA_DIR).map((o) => ({
          uri: `offers://${o.id}`,
          name: `${o.company} - ${o.title} [${o.status}]`,
          mimeType: MD
        }))
      })
    }),
    {
      title: "Analysed offer",
      description:
        "One complete offer: analysis, status log and interview notes. Meant for getting back into context before an interview.",
      mimeType: MD
    },
    async (uri, variables) => {
      const raw = Array.isArray(variables.id) ? variables.id[0]! : String(variables.id);
      const id = assertSafeId(decodeURIComponent(raw));
      const content = readIfExists(p.offer(id));
      if (content === undefined) {
        const available = listOffers(DATA_DIR).map((o) => o.id);
        return textResource(
          uri.href,
          `There is no offer "${id}".\n\n` +
            (available.length
              ? `Available offers:\n${available.map((d) => `  - ${d}`).join("\n")}`
              : "No offers analysed yet.")
        );
      }
      return textResource(uri.href, content);
    }
  );
}
