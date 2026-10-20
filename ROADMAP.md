# Roadmap

Ideas that came up during development but are not built yet. Nothing here is a
promise: each item needs a decision before anyone builds it. Contributions are
welcome, open an issue first to discuss the approach.

## Tooling

- **Install script.** Registering the server in a client is manual today
  (`claude mcp add` or editing `claude_desktop_config.json`). An
  `npm run install-client` could do it for you.

- **Protocol-level integration tests.** The unit tests cover the pure core
  (`src/lib`). The MCP layer (`tools.ts`, `resources.ts`, `prompts.ts`) is
  tested by hand with raw JSON-RPC. The SDK's own `Client` could drive
  end-to-end tests of every tool, resource and prompt.

- **Bilingual or configurable file format.** The markers (`[solid]`,
  `[count: N]`, `Sources:`, section names, statuses) are fixed English
  keywords. A small config could let people keep their vault in another
  language.

## Gap radar

- **Count per company, not per source.** `record_gap` takes `source` as free
  text ("Acme Backend Engineer, Remote") and "Tracked sources" counts that text
  as is. It measures how many gaps an offer uncovered, but it does not
  aggregate by company: two offers from Acme count as two sources.

- **Legacy sources with commas.** The source separator is `;` because source
  names contain commas. A hand-written line such as `Sources: A, B` is read as
  ONE source.

- **Watchlist promotion.** `record_gap` on a watchlist term bumps its count but
  keeps it in the watchlist. An alternative is to move it to "Confirmed by
  offers" automatically once its count reaches 1.

- **Server-side guard against recording a skill you already have.** Today the
  `analyze_offer` prompt tells the model not to call `record_gap` for anything in
  `skills.md`. The tool itself could refuse it.

## Offers

- **Section name collisions.** If a pasted analysis contained a literal
  `## Interview notes` or `## Status log` heading, the tools would write in the
  wrong place. Invisible HTML comments could delimit the fixed sections.

- **Scoring is defined by your criteria.** The `score` field accepts 0 to 100
  and its meaning comes from `criteria.md`. A structured scoring section could
  let the server validate the total.

## CV

- **`cv.md` and `cv-data.json` are two copies.** `cv.md` feeds the analysis
  prompt and `cv-data.json` feeds `render_cv`. If one changes, the other has to
  be updated by hand. `cv.md` could be generated from `cv-data.json`.

- **Height estimate without a browser.** `render_cv` estimates how full the page
  is with a heuristic calibrated against a real print. A headless browser check
  would be exact, at the cost of a heavy dependency.

- **Fonts load from Google Fonts.** The server itself never touches the network,
  but the generated HTML pulls its fonts from Google Fonts when opened. They
  could be bundled locally.

## Data

- **Version your vault.** Only the code is under git. Putting your own vault in
  a separate private repository gives you the history of how your radar evolved
  (which gaps appeared and when).

- **Write locking.** Writes are atomic (temp file + rename) but there is no
  lock: two simultaneous calls on the same file could lose one. With one user
  and one client this is not a real problem.

- **Dependency audit.** Keep an eye on `npm audit`. The server only uses the
  stdio transport, so advisories that affect the SDK's HTTP or OAuth code do not
  reach it, but updating is still the right default.
