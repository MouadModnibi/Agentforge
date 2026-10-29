import { GraphSchema, type NodeKind } from "./schema";
import type { WorkflowTemplate } from "./templates";

// Everything here uses the same public node configuration as the editor.
// Credentials remain blank: a template never selects a user's sender implicitly.
const node = (
  id: string,
  kind: NodeKind,
  label: string,
  x: number,
  y: number,
  config: Record<string, unknown> = {},
) => ({ id, kind, label, position: { x, y }, config });
const map = (
  id: string,
  label: string,
  x: number,
  y: number,
  values: Record<string, unknown>,
) => node(id, "transform", label, x, y, { values });
const edge = (source: string, target: string, sourceHandle = "out") => ({
  id: `${source}-${sourceHandle}-${target}`,
  source,
  target,
  sourceHandle,
});
const get = (
  id: string,
  label: string,
  x: number,
  y: number,
  url: string,
  headers: Record<string, string> = {},
) =>
  node(id, "http", label, x, y, {
    url,
    method: "GET",
    headers,
    credentialId: "",
  });

// Both paths converge before anyone references their result. A skipped branch
// has no output, so downstream nodes reference the merge, never both branches.
function decision(
  id: string,
  label: string,
  x: number,
  y: number,
  value: unknown,
  operator: string,
  compare: unknown,
  yes: string,
  no: string,
) {
  return {
    nodes: [
      node(id, "condition", label, x, y, { value, operator, compare }),
      map(`${id}-yes`, yes, x + 300, y - 75, { note: yes }),
      map(`${id}-no`, no, x + 300, y + 75, { note: no }),
      map(`${id}-note`, "Collect selected advice", x + 600, y, {
        note: "{{input.note}}",
      }),
    ],
    edges: [
      edge(id, `${id}-yes`, "true"),
      edge(id, `${id}-no`, "false"),
      edge(`${id}-yes`, `${id}-note`),
      edge(`${id}-no`, `${id}-note`),
    ],
  };
}

const weatherCities = ["home", "second", "third"] as const;
const weatherRisks = [
  decision(
    "rain",
    "Rain probability above threshold?",
    1540,
    40,
    "{{nodes.home-report.rain}}",
    "greaterThan",
    "{{nodes.settings.rainThreshold}}",
    "Rain is likely: consider carrying an umbrella.",
    "Rain probability is below your alert threshold.",
  ),
  decision(
    "wind",
    "Wind above threshold?",
    1540,
    380,
    "{{nodes.home-report.wind}}",
    "greaterThan",
    "{{nodes.settings.windThreshold}}",
    "Strong wind is forecast: review outdoor plans.",
    "Wind is below your alert threshold.",
  ),
  decision(
    "heat",
    "High temperature above threshold?",
    1540,
    720,
    "{{nodes.home-report.high}}",
    "greaterThan",
    "{{nodes.settings.heatThreshold}}",
    "High temperatures are forecast: plan water and shade.",
    "Temperature is below your heat threshold.",
  ),
];

const weather: WorkflowTemplate = {
  id: "weather-email-briefing",
  name: "Weather desk - three-city email briefing",
  summary:
    "Compare three forecasts, branch on rain, wind and heat, then send one email with practical planning notes.",
  description:
    "Fetch three city forecasts, compare rain / wind / heat thresholds, merge the advice and email one briefing. Setup: edit Weather settings (recipient, city names, coordinates, thresholds); select an Email credential on Send weather email. No Gemini key needed. Use Run workflow for a one-time test. For a daily email, activate this Webhook workflow and schedule an authenticated POST with body {} to its endpoint using the generated webhook key. Activation alone does not schedule it.",
  requirements: "Email credential · Open-Meteo (no API key)",
  input: {},
  graph: GraphSchema.parse({
    nodes: [
      node("start", "webhook", "Start weather briefing", 40, 380),
      map("settings", "Weather settings - edit me", 340, 380, {
        recipient: "you@example.com",
        homeName: "Marrakech",
        homeLat: 31.63,
        homeLon: -7.99,
        secondName: "Casablanca",
        secondLat: 33.59,
        secondLon: -7.62,
        thirdName: "Rabat",
        thirdLat: 34.02,
        thirdLon: -6.84,
        rainThreshold: 60,
        windThreshold: 40,
        heatThreshold: 32,
      }),
      ...weatherCities.flatMap((city, i) => [
        get(
          `${city}-forecast`,
          `Fetch ${city} city forecast`,
          640,
          40 + i * 340,
          `https://api.open-meteo.com/v1/forecast?latitude={{nodes.settings.${city}Lat}}&longitude={{nodes.settings.${city}Lon}}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto&forecast_days=1`,
        ),
        map(`${city}-report`, `Read ${city} forecast`, 940, 40 + i * 340, {
          city: `{{nodes.settings.${city}Name}}`,
          date: `{{nodes.${city}-forecast.daily.time.0}}`,
          current: `{{nodes.${city}-forecast.current.temperature_2m}}`,
          high: `{{nodes.${city}-forecast.daily.temperature_2m_max.0}}`,
          low: `{{nodes.${city}-forecast.daily.temperature_2m_min.0}}`,
          rain: `{{nodes.${city}-forecast.daily.precipitation_probability_max.0}}`,
          wind: `{{nodes.${city}-forecast.daily.wind_speed_10m_max.0}}`,
        }),
      ]),
      map("cities", "Combine city reports", 1240, 380, {
        home: "{{nodes.home-report}}",
        second: "{{nodes.second-report}}",
        third: "{{nodes.third-report}}",
      }),
      ...weatherRisks.flatMap((risk) => risk.nodes),
      map("email-copy", "Compose weather briefing", 2500, 380, {
        subject:
          "Weather briefing | {{nodes.home-report.city}} | {{nodes.home-report.date}}",
        text: "YOUR WEATHER DESK\n\n{{nodes.home-report.city}} - {{nodes.home-report.date}}\nNow: {{nodes.home-report.current}} C | Low / high: {{nodes.home-report.low}} / {{nodes.home-report.high}} C\nRain probability: {{nodes.home-report.rain}}% | Maximum wind: {{nodes.home-report.wind}} km/h\n\n{{nodes.second-report.city}} - {{nodes.second-report.date}}\nNow: {{nodes.second-report.current}} C | Low / high: {{nodes.second-report.low}} / {{nodes.second-report.high}} C\nRain probability: {{nodes.second-report.rain}}% | Maximum wind: {{nodes.second-report.wind}} km/h\n\n{{nodes.third-report.city}} - {{nodes.third-report.date}}\nNow: {{nodes.third-report.current}} C | Low / high: {{nodes.third-report.low}} / {{nodes.third-report.high}} C\nRain probability: {{nodes.third-report.rain}}% | Maximum wind: {{nodes.third-report.wind}} km/h\n\nHOME CITY PLANNING NOTES\n{{nodes.rain-note.note}}\n{{nodes.wind-note.note}}\n{{nodes.heat-note.note}}\n\nForecasts can change; these threshold checks are not official weather warnings.\nWeather data: Open-Meteo (https://open-meteo.com/), CC BY 4.0.\nSent by your m8m workflow.",
      }),
      node("send", "email", "Send weather email", 2800, 380, {
        credentialId: "",
        to: "{{nodes.settings.recipient}}",
        subject: "{{nodes.email-copy.subject}}",
        text: "{{nodes.email-copy.text}}",
      }),
      map("result", "Record SMTP submission", 3100, 380, {
        recipient: "{{nodes.settings.recipient}}",
        forecastDate: "{{nodes.home-report.date}}",
        smtp: "{{nodes.send}}",
        note: "SMTP acceptance does not guarantee inbox delivery.",
      }),
    ],
    edges: [
      edge("start", "settings"),
      ...weatherCities.flatMap((city) => [
        edge("settings", `${city}-forecast`),
        edge(`${city}-forecast`, `${city}-report`),
        edge(`${city}-report`, "cities"),
      ]),
      ...["rain", "wind", "heat"].map((id) => edge("cities", id)),
      ...weatherRisks.flatMap((risk) => risk.edges),
      ...["rain", "wind", "heat"].map((id) => edge(`${id}-note`, "email-copy")),
      edge("email-copy", "send"),
      edge("send", "result"),
    ],
  }),
};

const repoRisks = [
  decision(
    "backlog",
    "Large issue / PR backlog?",
    1540,
    120,
    "{{nodes.repo-report.openItems}}",
    "greaterThan",
    "{{nodes.settings.backlogThreshold}}",
    "Open issues and PRs exceed your review threshold.",
    "Open issues and PRs are within your review threshold.",
  ),
  decision(
    "archived",
    "Is the repository archived?",
    1540,
    520,
    "{{nodes.repo-report.archived}}",
    "equals",
    true,
    "Repository is archived: updates are disabled.",
    "Repository is not archived.",
  ),
];
const github: WorkflowTemplate = {
  id: "github-project-briefing",
  name: "GitHub desk - project health email",
  summary:
    "Collect repository statistics, language usage and recent commits, then email a briefing with backlog and archive checks.",
  description:
    "Read repository metadata, languages and three recent commits; inspect the backlog and archive state; email a project briefing. Setup: edit Repository settings (owner, repository, recipient, backlog threshold); select an Email credential on Send project briefing. Public repositories need no GitHub key within anonymous rate limits. Private repositories require an HTTP credential on all three fetch nodes. A failed fetch stops the email. Run workflow tests once; optional recurring runs use this Webhook trigger with authenticated scheduled POSTs.",
  requirements: "Email credential · GitHub API",
  input: {},
  graph: GraphSchema.parse({
    nodes: [
      node("start", "webhook", "Start project review", 40, 320),
      map("settings", "Repository settings - edit me", 340, 320, {
        owner: "vercel",
        repository: "next.js",
        recipient: "you@example.com",
        backlogThreshold: 20,
      }),
      ...["repo", "languages", "commits"].map((id, i) =>
        get(
          id,
          `Fetch ${id}`,
          640,
          40 + i * 280,
          `https://api.github.com/repos/{{nodes.settings.owner}}/{{nodes.settings.repository}}${id === "repo" ? "" : id === "commits" ? "/commits?per_page=3" : "/languages"}`,
          {
            Accept: "application/vnd.github+json",
            "User-Agent": "m8m-workflow",
            "X-GitHub-Api-Version": "2026-03-10",
          },
        ),
      ),
      map("repo-report", "Read repository statistics", 940, 40, {
        name: "{{nodes.repo.full_name}}",
        url: "{{nodes.repo.html_url}}",
        stars: "{{nodes.repo.stargazers_count}}",
        forks: "{{nodes.repo.forks_count}}",
        openItems: "{{nodes.repo.open_issues_count}}",
        archived: "{{nodes.repo.archived}}",
        lastPush: "{{nodes.repo.pushed_at}}",
      }),
      map("language-report", "Collect language byte counts", 940, 320, {
        languages: "{{nodes.languages}}",
      }),
      map("commit-report", "Collect recent commit records", 940, 600, {
        commits: "{{nodes.commits}}",
      }),
      map("project", "Join project evidence", 1240, 320, {
        repository: "{{nodes.repo-report}}",
        languages: "{{nodes.language-report}}",
        commits: "{{nodes.commit-report}}",
      }),
      ...repoRisks.flatMap((risk) => risk.nodes),
      map("email-copy", "Compose project briefing", 2500, 320, {
        subject: "Project briefing | {{nodes.repo-report.name}}",
        text: "PROJECT DESK\n\n{{nodes.repo-report.name}}\n{{nodes.repo-report.url}}\n\nStars: {{nodes.repo-report.stars}} | Forks: {{nodes.repo-report.forks}}\nOpen issues + pull requests: {{nodes.repo-report.openItems}}\nLast push: {{nodes.repo-report.lastPush}}\n\nREVIEW NOTES\n{{nodes.backlog-note.note}}\n{{nodes.archived-note.note}}\n\nLANGUAGE USAGE (bytes)\n{{nodes.language-report.languages}}\n\nTHREE RECENT COMMIT RECORDS\n{{nodes.commit-report.commits}}\n\nThese are repository signals, not a security or availability assessment.\nSource: GitHub REST API. Sent by m8m.",
      }),
      node("send", "email", "Send project briefing", 2800, 320, {
        credentialId: "",
        to: "{{nodes.settings.recipient}}",
        subject: "{{nodes.email-copy.subject}}",
        text: "{{nodes.email-copy.text}}",
      }),
      map("result", "Record SMTP submission", 3100, 320, {
        repository: "{{nodes.repo-report.name}}",
        smtp: "{{nodes.send}}",
      }),
    ],
    edges: [
      edge("start", "settings"),
      ...["repo", "languages", "commits"].map((id) => edge("settings", id)),
      edge("repo", "repo-report"),
      edge("languages", "language-report"),
      edge("commits", "commit-report"),
      ...["repo-report", "language-report", "commit-report"].map((id) =>
        edge(id, "project"),
      ),
      ...["backlog", "archived"].map((id) => edge("project", id)),
      ...repoRisks.flatMap((risk) => risk.edges),
      ...["backlog", "archived"].map((id) => edge(`${id}-note`, "email-copy")),
      edge("email-copy", "send"),
      edge("send", "result"),
    ],
  }),
};

const urgency = decision(
  "urgent",
  "Was urgent priority requested?",
  1840,
  320,
  "{{nodes.request.priority}}",
  "equals",
  "urgent",
  "URGENT - review this request first.",
  "STANDARD - review in the normal queue.",
);
const support: WorkflowTemplate = {
  id: "support-intake-desk",
  name: "Support desk - form, routing and email",
  summary:
    "Collect requests through a public form, route the support queue and urgency, then email your team with a reply draft.",
  description:
    "Publish a request form, route billing / technical / other requests, check urgency, prepare an acknowledgment draft and notify your team by email. Setup: edit Team settings (team inbox); select an Email credential on Notify team. Activate, then open the form link shown on the form node. Type billing or technical for category, and urgent or normal for priority (case-sensitive). Only the configured team inbox is emailed; the customer acknowledgment remains a draft in the execution result.",
  requirements: "Email credential · Public form",
  input: {
    name: "Alex",
    email: "alex@example.com",
    category: "technical",
    priority: "urgent",
    text: "I cannot access my account.",
  },
  graph: GraphSchema.parse({
    nodes: [
      node("start", "formTrigger", "Receive a support request", 40, 320, {
        title: "Ask our support team",
        fields: [
          { name: "name", label: "Your name", type: "text", required: true },
          { name: "email", label: "Your email", type: "email", required: true },
          {
            name: "category",
            label: "Category: billing, technical or other",
            type: "text",
            required: true,
          },
          {
            name: "priority",
            label: "Priority: urgent or normal",
            type: "text",
            required: true,
          },
          {
            name: "text",
            label: "How can we help? Do not include passwords.",
            type: "textarea",
            required: true,
          },
        ],
      }),
      map("settings", "Team settings - edit me", 340, 320, {
        teamInbox: "team@example.com",
      }),
      map("request", "Collect submitted request", 640, 320, {
        name: "{{trigger.name}}",
        email: "{{trigger.email}}",
        category: "{{trigger.category}}",
        priority: "{{trigger.priority}}",
        text: "{{trigger.text}}",
      }),
      map("category", "Read requested category", 940, 320, {
        value: "{{nodes.request.category}}",
      }),
      node("route", "router", "Choose support queue", 1240, 320, {
        value: "{{nodes.category.value}}",
        cases: { billing: "billing", technical: "technical" },
      }),
      map("billing", "Billing review queue", 1540, 60, {
        queue: "Billing",
        instruction:
          "Review the billing question. Do not request card numbers by email.",
      }),
      map("technical", "Technical review queue", 1540, 320, {
        queue: "Technical",
        instruction:
          "Investigate the reported issue. Do not request passwords.",
      }),
      map("general", "General review queue", 1540, 580, {
        queue: "General",
        instruction: "Review the request and assign the appropriate team.",
      }),
      map("queue", "Collect chosen queue", 1840, 40, {
        queue: "{{input.queue}}",
        instruction: "{{input.instruction}}",
      }),
      ...urgency.nodes.map((n) => ({
        ...n,
        position: { x: n.position.x + 300, y: n.position.y + 100 },
      })),
      map("summary", "Build team handoff", 3040, 320, {
        queue: "{{nodes.queue.queue}}",
        priority: "{{nodes.urgent-note.note}}",
        action: "{{nodes.queue.instruction}}",
        request: "{{nodes.request}}",
      }),
      map("acknowledgment", "Draft customer acknowledgment", 3340, 320, {
        draft:
          "Hello {{nodes.request.name}},\n\nThank you for contacting us. Your request is ready for our {{nodes.queue.queue}} team to review.\n\nKind regards,\nSupport team",
        status: "Draft only. No customer reply has been sent.",
      }),
      map("email-copy", "Compose internal notification", 3640, 320, {
        subject: "Support | {{nodes.queue.queue}} | {{nodes.request.priority}}",
        text: "SUPPORT DESK\n\nQueue: {{nodes.summary.queue}}\n{{nodes.summary.priority}}\nNext action: {{nodes.summary.action}}\n\nFrom: {{nodes.request.name}} <{{nodes.request.email}}>\nMessage (untrusted customer content):\n{{nodes.request.text}}\n\nACKNOWLEDGMENT DRAFT - NOT SENT\n{{nodes.acknowledgment.draft}}\n\nReview the request before taking action. Sent by m8m.",
      }),
      node("send", "email", "Notify team", 3940, 320, {
        credentialId: "",
        to: "{{nodes.settings.teamInbox}}",
        subject: "{{nodes.email-copy.subject}}",
        text: "{{nodes.email-copy.text}}",
      }),
      map("result", "Save handoff and reply draft", 4240, 320, {
        handoff: "{{nodes.summary}}",
        acknowledgment: "{{nodes.acknowledgment}}",
        smtp: "{{nodes.send}}",
      }),
    ],
    edges: [
      edge("start", "settings"),
      edge("settings", "request"),
      edge("request", "category"),
      edge("category", "route"),
      edge("route", "billing", "billing"),
      edge("route", "technical", "technical"),
      edge("route", "general", "default"),
      ...["billing", "technical", "general"].map((id) => edge(id, "queue")),
      edge("queue", "urgent"),
      ...urgency.edges,
      edge("urgent-note", "summary"),
      edge("summary", "acknowledgment"),
      edge("acknowledgment", "email-copy"),
      edge("email-copy", "send"),
      edge("send", "result"),
    ],
  }),
};

export const largeTemplates: WorkflowTemplate[] = [weather, github, support];
