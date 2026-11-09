import type { NodeKind } from "./schema";
export interface Field {
  key: string;
  label: string;
  type?: "json" | "agent" | "credential" | "select" | "number" | "text";
  options?: string[];
  placeholder?: string;
}
export interface NodeDefinition {
  name: string;
  description: string;
  category: "Triggers" | "AI" | "Logic" | "Actions";
  color: string;
  icon: string;
  fields: Field[];
  defaults: Record<string, unknown>;
  outputs: string[];
  sideEffect?: boolean;
}
const credential: Field = {
  key: "credentialId",
  label: "Credential",
  type: "credential",
};
export const catalog: Record<NodeKind, NodeDefinition> = {
  formTrigger: {
    name: "HTML form trigger",
    description: "Generate a public form that starts this workflow",
    category: "Triggers",
    color: "#e8bf66",
    icon: "globe",
    fields: [
      { key: "title", label: "Form title" },
      { key: "fields", label: "Form fields", type: "json" },
    ],
    defaults: {
      title: "Send a request",
      fields: [
        {
          name: "text",
          label: "Your message",
          type: "textarea",
          required: true,
        },
      ],
    },
    outputs: ["out"],
  },
  manual: {
    name: "Manual trigger",
    description: "Start with the Run button",
    category: "Triggers",
    color: "#e8bf66",
    icon: "play",
    fields: [],
    defaults: {},
    outputs: ["out"],
  },
  webhook: {
    name: "Webhook",
    description: "Receive an authenticated HTTP event",
    category: "Triggers",
    color: "#e8bf66",
    icon: "webhook",
    fields: [],
    defaults: {},
    outputs: ["out"],
  },
  telegramTrigger: {
    name: "Telegram trigger",
    description: "Receive bot messages via webhook",
    category: "Triggers",
    color: "#e8bf66",
    icon: "send",
    fields: [credential],
    defaults: { credentialId: "" },
    outputs: ["out"],
  },
  emailTrigger: {
    name: "Email trigger",
    description: "Poll an IMAP mailbox for new mail",
    category: "Triggers",
    color: "#e8bf66",
    icon: "mail",
    fields: [credential, { key: "mailbox", label: "Mailbox" }],
    defaults: { credentialId: "", mailbox: "INBOX" },
    outputs: ["out"],
  },
  xTrigger: {
    name: "X / Twitter trigger",
    description: "Poll mentions with your X API access",
    category: "Triggers",
    color: "#e8bf66",
    icon: "message",
    fields: [credential],
    defaults: { credentialId: "" },
    outputs: ["out"],
  },
  agent: {
    name: "m8m agent",
    description: "Run one of your existing agents",
    category: "AI",
    color: "#b8d2e8",
    icon: "bot",
    fields: [
      { key: "agentId", label: "Agent", type: "agent" },
      { key: "input", label: "Agent inputs", type: "json" },
    ],
    defaults: { agentId: "", input: { text: "{{input.text}}" } },
    outputs: ["out"],
  },
  gemini: {
    name: "Gemini prompt",
    description: "Generate text using your Gemini provider",
    category: "AI",
    color: "#b8d2e8",
    icon: "sparkles",
    fields: [
      { key: "model", label: "Model" },
      { key: "prompt", label: "Prompt" },
    ],
    defaults: {
      model: "gemini-3.8-flash",
      prompt: "Summarize: {{input.text}}",
    },
    outputs: ["out"],
  },
  condition: {
    name: "Condition",
    description: "Choose the true or false branch",
    category: "Logic",
    color: "#b9b7a5",
    icon: "split",
    fields: [
      { key: "value", label: "Value / reference" },
      {
        key: "operator",
        label: "Operator",
        type: "select",
        options: [
          "equals",
          "notEquals",
          "contains",
          "greaterThan",
          "lessThan",
          "exists",
        ],
      },
      { key: "compare", label: "Compare to (JSON value)", type: "json" },
    ],
    defaults: {
      value: "{{input.priority}}",
      operator: "equals",
      compare: "high",
    },
    outputs: ["true", "false"],
  },
  router: {
    name: "Router",
    description: "Route data using named cases",
    category: "Logic",
    color: "#b9b7a5",
    icon: "split",
    fields: [
      { key: "value", label: "Value / reference" },
      { key: "cases", label: 'Cases: {"route": "value"}', type: "json" },
    ],
    defaults: {
      value: "{{input.category}}",
      cases: { support: "support", sales: "sales" },
    },
    outputs: ["default"],
  },
  transform: {
    name: "Set data",
    description: "Map and reshape the next input",
    category: "Logic",
    color: "#b9b7a5",
    icon: "braces",
    fields: [{ key: "values", label: "Output data", type: "json" }],
    defaults: { values: { message: "{{input.text}}" } },
    outputs: ["out"],
  },
  http: {
    name: "HTTP request",
    description: "Call an API with guarded networking",
    category: "Actions",
    color: "#9dc6b1",
    icon: "globe",
    fields: [
      { key: "url", label: "URL" },
      {
        key: "method",
        label: "Method",
        type: "select",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      },
      { key: "headers", label: "Public headers", type: "json" },
      credential,
      { key: "body", label: "JSON body", type: "json" },
    ],
    defaults: {
      url: "https://httpbin.org/get",
      method: "GET",
      headers: {},
      body: {},
      credentialId: "",
    },
    outputs: ["out"],
    sideEffect: true,
  },
  customTool: {
    name: "Custom tool",
    description: "Run an existing agent’s isolated code tool",
    category: "Actions",
    color: "#9dc6b1",
    icon: "code",
    fields: [
      { key: "agentId", label: "Agent containing the tool", type: "agent" },
      { key: "args", label: "Arguments", type: "json" },
    ],
    defaults: { agentId: "", args: {} },
    outputs: ["out"],
  },
  telegram: {
    name: "Telegram message",
    description: "Send a message through your bot",
    category: "Actions",
    color: "#9dc6b1",
    icon: "send",
    fields: [
      credential,
      { key: "chatId", label: "Chat ID" },
      { key: "text", label: "Message" },
    ],
    defaults: {
      credentialId: "",
      chatId: "{{input.chatId}}",
      text: "{{input.text}}",
    },
    outputs: ["out"],
    sideEffect: true,
  },
  discord: {
    name: "Discord message",
    description: "Post to a Discord channel using a saved webhook",
    category: "Actions",
    color: "#9dc6b1",
    icon: "message",
    fields: [
      credential,
      { key: "text", label: "Message (up to 2000 characters)" },
      { key: "threadId", label: "Thread ID (optional)" },
    ],
    defaults: { credentialId: "", text: "{{input.text}}", threadId: "" },
    outputs: ["out"],
    sideEffect: true,
  },
  email: {
    name: "Send email",
    description: "Deliver an email over SMTP",
    category: "Actions",
    color: "#9dc6b1",
    icon: "mail",
    fields: [
      credential,
      { key: "to", label: "Recipient" },
      { key: "subject", label: "Subject" },
      { key: "text", label: "Message" },
    ],
    defaults: {
      credentialId: "",
      to: "",
      subject: "m8m workflow",
      text: "{{input.text}}",
    },
    outputs: ["out"],
    sideEffect: true,
  },
  x: {
    name: "X / Twitter post",
    description: "Publish with an X user access token",
    category: "Actions",
    color: "#9dc6b1",
    icon: "message",
    fields: [credential, { key: "text", label: "Post text" }],
    defaults: { credentialId: "", text: "{{input.text}}" },
    outputs: ["out"],
    sideEffect: true,
  },
  // ─── Extended integrations ────────────────────────────────────────────────
  slack: {
    name: "Slack message",
    description: "Post a message to a Slack channel or user",
    category: "Actions",
    color: "#4A154B",
    icon: "slack",
    fields: [
      credential,
      { key: "channel", label: "Channel (e.g. #general)" },
      { key: "text", label: "Message text" },
    ],
    defaults: { credentialId: "", channel: "#general", text: "{{input.text}}" },
    outputs: ["out"],
    sideEffect: true,
  },
  notion: {
    name: "Notion page",
    description: "Create or append a page in your Notion workspace",
    category: "Actions",
    color: "#ffffff",
    icon: "notion",
    fields: [
      credential,
      { key: "databaseId", label: "Database ID" },
      { key: "title", label: "Page title" },
      { key: "content", label: "Page content (Markdown)" },
    ],
    defaults: {
      credentialId: "",
      databaseId: "",
      title: "{{input.text}}",
      content: "",
    },
    outputs: ["out"],
    sideEffect: true,
  },
  github: {
    name: "GitHub issue",
    description: "Open an issue or comment on a GitHub repository",
    category: "Actions",
    color: "#e8e8e8",
    icon: "github",
    fields: [
      credential,
      { key: "repo", label: "Repository (owner/repo)" },
      { key: "title", label: "Issue title" },
      { key: "body", label: "Issue body" },
    ],
    defaults: {
      credentialId: "",
      repo: "owner/repo",
      title: "{{input.text}}",
      body: "",
    },
    outputs: ["out"],
    sideEffect: true,
  },
  youtube: {
    name: "YouTube search",
    description: "Search YouTube videos and return top results",
    category: "Actions",
    color: "#FF0000",
    icon: "youtube",
    fields: [
      credential,
      { key: "query", label: "Search query" },
      { key: "maxResults", label: "Max results", type: "number" },
    ],
    defaults: { credentialId: "", query: "{{input.text}}", maxResults: 5 },
    outputs: ["out"],
  },
  rss: {
    name: "RSS feed",
    description: "Fetch and parse the latest items from any RSS feed",
    category: "Triggers",
    color: "#f26522",
    icon: "rss",
    fields: [
      { key: "url", label: "Feed URL" },
      { key: "maxItems", label: "Max items", type: "number" },
    ],
    defaults: { url: "https://feeds.bbci.co.uk/news/rss.xml", maxItems: 5 },
    outputs: ["out"],
  },
  sheets: {
    name: "Google Sheets",
    description: "Append a row to a Google Sheets spreadsheet",
    category: "Actions",
    color: "#34A853",
    icon: "sheets",
    fields: [
      credential,
      { key: "spreadsheetId", label: "Spreadsheet ID" },
      { key: "sheet", label: "Sheet name" },
      { key: "values", label: "Row values (JSON array)", type: "json" },
    ],
    defaults: {
      credentialId: "",
      spreadsheetId: "",
      sheet: "Sheet1",
      values: ["{{input.text}}"],
    },
    outputs: ["out"],
    sideEffect: true,
  },
  whatsapp: {
    name: "WhatsApp message",
    description: "Send a WhatsApp message via the Cloud API",
    category: "Actions",
    color: "#25D366",
    icon: "whatsapp",
    fields: [
      credential,
      { key: "to", label: "Recipient phone (E.164)" },
      { key: "text", label: "Message" },
    ],
    defaults: { credentialId: "", to: "+1234567890", text: "{{input.text}}" },
    outputs: ["out"],
    sideEffect: true,
  },
  linkedin: {
    name: "LinkedIn post",
    description: "Publish a post to your LinkedIn profile",
    category: "Actions",
    color: "#0A66C2",
    icon: "linkedin",
    fields: [
      credential,
      { key: "text", label: "Post text" },
    ],
    defaults: { credentialId: "", text: "{{input.text}}" },
    outputs: ["out"],
    sideEffect: true,
  },
  weather: {
    name: "Weather",
    description: "Fetch current weather for any city via Open-Meteo (free)",
    category: "Actions",
    color: "#38bdf8",
    icon: "weather",
    fields: [
      { key: "city", label: "City name" },
      { key: "units", label: "Units", type: "select", options: ["celsius", "fahrenheit"] },
    ],
    defaults: { city: "{{input.city}}", units: "celsius" },
    outputs: ["out"],
  },
};
export const isTrigger = (kind: NodeKind) =>
  catalog[kind].category === "Triggers";
export function outputHandles(node: {
  kind: NodeKind;
  config: Record<string, unknown>;
}): string[] {
  return node.kind === "router"
    ? [...Object.keys((node.config.cases ?? {}) as object), "default"]
    : catalog[node.kind].outputs;
}
