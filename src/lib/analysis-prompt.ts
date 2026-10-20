import { findSection, toLines } from "./markdown.js";

/**
 * Texto del prompt analyze_offer. Vive aqui, separado del registro MCP, para
 * poder testearlo como funcion pura.
 *
 * El objetivo profesional NO esta escrito en el codigo: sale de la seccion
 * '## Goal' de criteria.md. Cada usuario tiene el suyo, y el servidor no opina.
 */

export const GOAL_SECTION = "Goal";

/** Texto de '## Goal' en criteria.md, o undefined si falta o esta vacia. */
export function extractGoal(criteria: string | undefined): string | undefined {
  if (!criteria) return undefined;
  const lines = toLines(criteria);
  const section = findSection(lines, GOAL_SECTION, 2);
  if (!section) return undefined;
  const text = lines
    .slice(section.start, section.end)
    // Los comentarios HTML son instrucciones de la plantilla, no el objetivo.
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  return text || undefined;
}

export interface AnalysisInputs {
  skills: string | undefined;
  criteria: string | undefined;
  cv: string | undefined;
}

export function buildAnalysisPrompt({ skills, criteria, cv }: AnalysisInputs): string {
  const goal = extractGoal(criteria);

  const goalBlock = goal
    ? ["My long-term career goal (from criteria.md):", "", goal, ""]
    : [
        "IMPORTANT: my criteria.md has no `## Goal` section, so you do not know my",
        "career goal yet. Before analysing, ask me to state it in one or two",
        "sentences (the kind of role and company I am aiming for, and why), and",
        "suggest I add it to profile/criteria.md under `## Goal` so you have it next",
        "time. Then run the analysis against the goal I give you.",
        ""
      ];

  const cvBlock = cv
    ? ["## My CV", "", cv, ""]
    : [
        "## My CV",
        "",
        "(There is no profile/cv.md in the vault. For point 2 use only the skills",
        "profile above, and warn me that the evidence will be less concrete than it",
        "should be.)",
        ""
      ];

  return [
    "Analyse this job offer against my profile. Be honest, do not sugar-coat it.",
    "",
    ...goalBlock,
    "Each offer is judged ON ITS OWN, against my profile and nothing else. Do not",
    "compare it with other offers in the pipeline, do not say which one is better",
    "and do not ask me to choose between several: each one is decided by itself.",
    "",
    "Structure your answer like this:",
    "",
    "1. **Verdict**: pick ONE of these four and justify it. The justification is",
    "   what matters, so ground it in concrete requirements of the offer and",
    "   concrete evidence from my profile.",
    "   - *Good fit*: I meet what it asks for, applying is the obvious move.",
    "   - *Reasonable reach*: I am missing something real, but it is defensible",
    "     and worth the shot.",
    "   - *Too demanding*: the level it asks for is above where I am today. Say",
    "     exactly what puts it out of reach.",
    "   - *Not worth the time*: I clear the technical bar, but it fails on what",
    "     matters to me according to my criteria.",
    "",
    "   Salary NEVER decides the verdict: neither a low salary nor an unpublished",
    "   one justifies *Not worth the time*. Mention it as a data point and score",
    "   it on its axis, nothing more.",
    "",
    "2. **What I already have** that the offer asks for. Cite concrete evidence",
    "   from my CV or projects, not generic claims.",
    "",
    "3. **What I do NOT have** and the offer asks for. Split it into:",
    "   - Must-have (without it they will not read my CV)",
    "   - Nice-to-have (adds up but does not block)",
    "   - Noise (they list it but it does not matter, it is learned on the job)",
    "",
    "4. **The cheapest gap to close**: of everything I am missing, what would",
    "   take the least effort to move me from \"not qualified\" to \"defensible",
    "   candidate\".",
    "",
    "5. **Terms I do not master**: list the technical concepts in the offer that",
    "   I should be able to define in an interview and probably cannot. Do not",
    "   explain them yet, just list them so I can ask for the ones I want.",
    "",
    "6. **What to highlight and what to leave out of the CV for THIS offer**:",
    "   which three things from my profile go at the very top, and which",
    "   irrelevant things to remove so they do not dilute the rest.",
    "",
    "---",
    "",
    "## What to do after the analysis",
    "",
    "When you finish the analysis, and only then:",
    "",
    "- Save the analysis with `save_offer`. The id is YYYY-MM-company",
    "  (e.g. 2026-07-acme). Include `score` only if my criteria define how to",
    "  score an offer and you were able to apply them.",
    "- For EACH term from points 3 and 5 that I do not have, call `record_gap`",
    "  once, with its category and this offer as the source. They are two",
    "  different sources of gaps: point 3 are job requirements, point 5 are",
    "  concepts I could not defend in an interview. Both count.",
    "- Do NOT call `record_gap` for anything already in my skills profile.",
    "- Do NOT call `confirm_skill` on your own: only I confirm that, once I have",
    "  really acquired the skill.",
    "- At the end, offer me a CV tailored to this offer: tell me in two lines",
    "  which projects you would put first and what you would remove, based on",
    "  point 6. Do NOT call `render_cv` until I say yes. When I do, remember you",
    "  can only choose content that already exists in cv-data.json.",
    "",
    "---",
    "",
    "## My skills profile (what I ALREADY have)",
    "",
    skills ?? "(profile/skills.md was not found)",
    "",
    "---",
    "",
    ...cvBlock,
    "---",
    "",
    "## My decision criteria",
    "",
    criteria ?? "(profile/criteria.md was not found)",
    "",
    "---",
    "",
    "The offer text goes below this line:",
    ""
  ].join("\n");
}
