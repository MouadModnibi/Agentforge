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
