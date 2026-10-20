import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DATA_DIR } from "./config.js";
import { checkDataDir } from "./lib/files.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

// El nombre y la version se los anuncia el servidor al cliente en el handshake
// `initialize`. Es lo que veras identificado en la lista de servidores MCP.
const server = new McpServer({
  name: "job-radar",
  version: "0.1.0"
});

registerResources(server);
registerTools(server);
registerPrompts(server);

async function main() {
  // Una carpeta que falta NO se crea en silencio: con una ruta mal escrita el
  // servidor trabajaria sobre una boveda vacia sin que nadie se entere. Se avisa
  // por stderr y se arranca igualmente, para que ping y los errores de cada
  // tool expliquen el problema desde el propio cliente.
  const problema = checkDataDir(DATA_DIR);
  if (problema) console.error(problema);

  // stdio: el cliente nos lanza como proceso hijo y hablamos JSON-RPC por
  // stdin/stdout. Por eso NUNCA se hace console.log aqui: stdout es el canal
  // del protocolo. Todo log de diagnostico va a stderr.
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`job-radar-mcp listening on stdio. Data dir: ${DATA_DIR}`);
}

main().catch((error) => {
  console.error("Fatal error starting the server:", error);
  process.exit(1);
});
