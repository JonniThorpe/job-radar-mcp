import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { paths } from "./config.js";
import { buildAnalysisPrompt } from "./lib/analysis-prompt.js";
import { readIfExists } from "./lib/files.js";

/**
 * Prompts: el unico primitivo que invoca el USUARIO, no el modelo.
 *
 * Un prompt es una plantilla que el servidor rellena con datos frescos y
 * entrega al cliente como mensajes iniciales. Aparece en el menu '/'.
 *
 * Aqui resuelve un problema concreto: la plantilla de analisis pide pegar el
 * perfil y el CV a mano, y lo que se pega a mano se queda desactualizado. El
 * servidor los lee del disco EN EL MOMENTO de invocar el prompt, asi que el
 * analisis siempre corre contra el perfil de hoy.
 */
export function registerPrompts(server: McpServer): void {
  const p = paths();

  server.registerPrompt(
    "analyze_offer",
    {
      title: "Analyse a job offer",
      description:
        "Returns the analysis template filled in with your current skills profile, CV and criteria (including your career goal), ready for you to paste the offer text below."
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildAnalysisPrompt({
              skills: readIfExists(p.skills),
              criteria: readIfExists(p.criteria),
              cv: readIfExists(p.cv)
            })
          }
        }
      ]
    })
  );
}
