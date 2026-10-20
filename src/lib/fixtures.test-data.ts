/**
 * Fixtures de una persona ficticia (Alex Morgan) con las mismas trampas que
 * tienen los archivos reales: la seccion '## Rules' con vinietas que NO son
 * huecos, la watchlist con contador 0, las notas entre parentesis y las fuentes
 * con comas dentro.
 */

export const SKILLS_MD = `# Skills profile: what I have

Only skills I actually have, at level **[solid]** or **[partial]**.

---

## Programming languages
- [solid] Java (Java 17, two years at Brightloop plus the backend of the OrderBot project)
- [solid] Python (data scripts, automation, fine-tuning experiments)
- [partial] JavaScript and TypeScript

## Backend
- [solid] Spring and Spring Boot
- [solid] Testing: JUnit 5, Mockito, code coverage
- [partial] Tomcat, Maven

## Infrastructure, DevOps and deployment
- [solid] Docker
- [partial] Cloud GPUs (used for fine-tuning, not in production)
`;

export const RADAR_MD = `# Gap radar

Skills that offers ask for and I do not have yet.

## Rules
- When an offer asks for something already listed here, bump its count by one.
- Add the source and also a count to the tracked sources section.
- Skills I already have never live here.

## Confirmed by offers
- [count: 1] Large-scale distributed systems and infrastructure (Infrastructure). Sources: Acme Platform Engineer, Remote.
- [count: 3] Large-scale system design (Fundamentals). Sources: Acme Backend Engineer, Remote
- [count: 1] Accessibility, a11y (Frontend). Sources: Acme Backend Engineer, Remote.

## Watchlist
Hypotheses worth tracking that no offer has asked for yet.
- [count: 0] Kubernetes (Infrastructure).
- [count: 0] Graph RAG (LLM engineering).

## Tracked sources
`;

/**
 * Base del CV de Alex Morgan. Se duplica aqui a proposito: los tests no deben
 * depender de ninguna boveda, y asi el test de calibracion mide siempre el
 * mismo contenido. Las longitudes de texto estan elegidas para que el CV de
 * referencia (CV_REFERENCE) llene la pagina casi entera, como el CV sobre el
 * que se midio la calibracion.
 */
export const CV_BASE = {
  identity: {
    name: "Alex Morgan",
    headline: "Full-Stack Engineer ·<br>Applied Machine Learning",
    location: "Northbridge, Westland, Exampleland",
    links: [
      { label: "+00 000 000 000", href: "tel:+00000000000" },
      { label: "alex@example.com", href: "mailto:alex@example.com" },
      { label: "alexmorgan.example", href: "https://alexmorgan.example" },
      { label: "linkedin.com/in/alex-morgan-example", href: "https://www.linkedin.com/in/x" },
      { label: "github.com/alex-morgan", href: "https://github.com/alex-morgan" },
      { label: "gitlab.com/alexmorgan", href: "https://gitlab.com/alexmorgan" }
    ]
  },
  summary:
    "Software Engineer with a backend foundation (Java, Spring, SQL) and experience building web products end to end. I apply machine learning to real business problems: fine-tuning small language and vision models and integrating LLMs.",
  stack: [
    { id: "languages", label: "Languages", tags: ["Java", "Python", "JS / TS", "C#", "Go", "SQL", "HTML/CSS"] },
    { id: "frameworks", label: "Frameworks", tags: ["Spring", "React", "Next.js", "Vue", "ASP.NET", "Flask", "Mockito"] },
    { id: "ai", label: "AI / ML", tags: ["LoRA", "PEFT", "PyTorch", "Mistral", "Llama", "Gemma", "OCR pipelines", "Whisper", "MCP"] },
    { id: "databases", label: "Databases", tags: ["PostgreSQL", "MySQL", "SQLite", "Supabase"] },
    { id: "devops", label: "Tools & DevOps", tags: ["Git", "Docker", "CI/CD", "GitHub Actions", "Fly.io", "Modal", "Jetty", "Maven", "nginx"] },
    { id: "methodologies", label: "Methodologies", tags: ["Scrum / Agile", "TDD", "Unit testing", "SOLID", "Design patterns", "Code review", "Quality gates"] }
  ],
  experience: [
    {
      id: "brightloop",
      role: "Junior Developer",
      org: "Brightloop Software Ltd",
      dates: "Jan 2023 - Oct 2024",
      bullets: [
        { id: "brightloop-backend", text: "Backend development and maintenance in Java 17 with Spring and PostgreSQL." },
        { id: "brightloop-tests", text: "Wrote unit tests with Mockito and built internal admin screens in React." },
        { id: "brightloop-coverage", text: "Raised unit test coverage from 60% to over 90% on the modules I owned." },
        { id: "brightloop-db", text: "Database administration, SQL queries and releases on Tomcat servers." },
        { id: "brightloop-billing", text: "Contributor to the billing platform used by the company's clients." },
        { id: "brightloop-scrum", text: "Worked in a Scrum team with daily Git-based code review." }
      ]
    },
    {
      id: "greenleaf",
      role: "Web Application Developer",
      org: "Greenleaf Studio",
      dates: "Jun 2022 - Dec 2022",
      bullets: [
        { id: "greenleaf-web", text: "Web page design and layout." },
        { id: "greenleaf-crm", text: "Customisation of an open-source CRM." }
      ]
    },
    {
      id: "harbor",
      role: "Developer Intern",
      org: "Harbor Labs",
      dates: "Feb 2022 - May 2022",
      bullets: [
        { id: "harbor-app", text: "Solo development of a booking web application for a language school (ASP.NET)." },
        { id: "harbor-scrum", text: "Worked under an agile Scrum methodology." }
      ]
    }
  ],
  projects: [
    {
      id: "shelfscan",
      title: "ShelfScan - Final Degree Project",
      stack: "React · Vite · Supabase · Vision-language model (LoRA) · Cloud GPUs · Netlify",
      lines: [
        { label: "Need", text: "digitise data from paper delivery notes, removing manual data entry." },
        { label: "Idea", text: "combine OCR with a fine-tuned vision-language model to extract structured data automatically." },
        { label: "Build", text: "production pipeline (OCR + LLM API + Supabase) extracting structured JSON (supplier, tax ID, date, items, totals), self-hosted and live; parallel academic track fine-tuning a small vision-language model with LoRA/PEFT on rented cloud GPUs, with a real dataset augmented ~10x." }
      ]
    },
    {
      id: "orderbot",
      title: "OrderBot: AI Order Automation",
      stack: "Spring Boot · React · MySQL · Messaging API · OpenAI API · JWT · Docker",
      lines: [
        { label: "Need", text: "orders arrived as informal chat messages and required manual transcription." },
        { label: "Idea", text: "use an LLM to interpret natural language and generate structured orders automatically for the shop." },
        { label: "Build", text: "messaging API integration with custom Spring Boot webhooks (capturing both customer and shop-sent messages), plus Whisper audio transcription; currently onboarding the first pilot customers." }
      ]
    },
    {
      id: "portfolio",
      title: "Self-hosted Portfolio - alexmorgan.example",
      stack: "React 19 · Vite · nginx · Linux VPS · TLS/certbot · GitHub Actions CI/CD · IaC",
      lines: [
        { label: "Need", text: "build DevOps skills hands-on in a real project running in production." },
        { label: "Idea", text: "self-manage the full cycle (server, TLS, CI/CD, hardening) and set it up to deploy future web apps." },
        { label: "Build", text: "Ubuntu VPS with nginx, Let's Encrypt TLS and automated deployments via GitHub Actions on push." }
      ]
    },
    {
      id: "jobradar",
      title: "Job Radar MCP Server",
      stack: "TypeScript · Model Context Protocol SDK · Node · stdio · node:test",
      lines: [
        { label: "Need", text: "keep an evolving skills profile and job-offer pipeline usable by an LLM without copy-pasting context by hand." },
        { label: "Idea", text: "expose a personal Markdown vault to any MCP client through tools, resources and prompts." },
        { label: "Build", text: "MCP server exposing typed tools with Zod-validated schemas over a Markdown vault, with pure-function core, unit tests and atomic writes." }
      ]
    },
    {
      id: "store",
      title: "Online Store",
      stack: "Spring Boot · Thymeleaf · MySQL · Selenium (E2E)",
      lines: [
        { label: "Need", text: "give a local bakery its own online sales channel." },
        { label: "Idea", text: "build a full-stack e-commerce solution for a small local business." }
      ]
    },
    {
      id: "school",
      title: "Web App for a Language School",
      org: "Harbor Labs internship",
      stack: "C# · ASP.NET MVC · SQL Server",
      lines: [
        { label: "Need", text: "a local language school needed to digitise the management of its classes." },
        { label: "Idea", text: "address the real business needs of a local company with a tailor-made web application." }
      ]
    }
  ],
  education: [
    { id: "bsc", role: "BSc in Computer Science", org: "Northbridge University", dates: "2020 - 2024", note: "Software Engineering track" },
    { id: "hnd", role: "Higher National Diploma in Multiplatform Application Development", org: "Westland College", dates: "2018 - 2020" },
    { id: "cert", role: "Technician Certificate in Computer Systems & Networks", org: "Riverside Institute", dates: "2016 - 2018" }
  ],
  languages: [
    { name: "English", level: "Native" },
    { name: "French", level: "Professional" }
  ]
};

/**
 * Seleccion de referencia: llena la pagina casi entera. Es la linea base del
 * modelo de altura (ver cv.test.ts).
 */
export const CV_REFERENCE = {
  offerId: "calibration",
  stack: [
    { id: "languages" },
    { id: "frameworks" },
    { id: "ai", tags: ["LoRA", "PEFT", "PyTorch", "Mistral", "Llama", "Gemma", "OCR pipelines"] },
    { id: "databases" },
    { id: "devops", tags: ["Git", "Docker", "CI/CD", "Fly.io", "Modal", "Jetty", "Maven", "nginx"] },
    { id: "methodologies", tags: ["Scrum / Agile", "TDD", "Unit testing"] }
  ],
  experience: [{ id: "brightloop" }, { id: "greenleaf" }, { id: "harbor" }],
  projects: ["shelfscan", "orderbot", "portfolio", "store", "school"],
  education: ["bsc", "hnd", "cert"]
};
