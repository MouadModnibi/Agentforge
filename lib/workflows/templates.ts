import { GraphSchema, type WorkflowGraph } from "./schema";
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
  input: Record<string, unknown>;
}
const graph = (nodes: unknown[], edges: unknown[]) =>
  GraphSchema.parse({ nodes, edges });
export const templates: WorkflowTemplate[] = [
  {
    id: "starter",
    name: "Start from scratch",
    description: "An empty workflow with a manual trigger.",
    input: { text: "Hello from m4m" },
    graph: graph(
      [
        {
          id: "start",
          kind: "manual",
          label: "When I click Run",
          position: { x: 80, y: 180 },
          config: {},
        },
      ],
      [],
    ),
  },
  {
    id: "routing",
    name: "Route a support request",
    description: "Try branching and data mapping without any API keys.",
    input: { text: "I need help with my account", priority: "high" },
    graph: graph(
      [
        {
          id: "start",
          kind: "manual",
          label: "New support request",
          position: { x: 40, y: 200 },
          config: {},
        },
        {
          id: "priority",
          kind: "condition",
          label: "Is it urgent?",
          position: { x: 340, y: 200 },
          config: {
            value: "{{input.priority}}",
            operator: "equals",
            compare: "high",
          },
        },
        {
          id: "urgent",
          kind: "transform",
          label: "Escalate to support",
          position: { x: 650, y: 100 },
          config: {
            values: {
              queue: "urgent",
              message: "{{input.text}}",
              priority: "high",
            },
          },
        },
        {
          id: "normal",
          kind: "transform",
          label: "Add to standard queue",
          position: { x: 650, y: 330 },
          config: { values: { queue: "standard", message: "{{input.text}}" } },
        },
      ],
      [
        { id: "s-p", source: "start", target: "priority" },
        {
          id: "p-u",
          source: "priority",
          target: "urgent",
          sourceHandle: "true",
        },
        {
          id: "p-n",
          source: "priority",
          target: "normal",
          sourceHandle: "false",
        },
      ],
    ),
  },
  {
    id: "agent",
    name: "Agent-powered automation",
    description: "Turn an existing m4m agent into a reusable flow.",
    input: { text: "Summarize this message into one sentence." },
    graph: graph(
      [
        {
          id: "start",
          kind: "manual",
          label: "Receive a request",
          position: { x: 40, y: 180 },
          config: {},
        },
        {
          id: "agent",
          kind: "agent",
          label: "Process with my agent",
          position: { x: 340, y: 180 },
          config: { agentId: "", input: { text: "{{input.text}}" } },
        },
        {
          id: "result",
          kind: "transform",
          label: "Package the result",
          position: { x: 650, y: 180 },
          config: {
            values: { result: "{{nodes.agent}}", source: "m4m" },
          },
        },
      ],
      [
        { id: "s-a", source: "start", target: "agent" },
        { id: "a-r", source: "agent", target: "result" },
      ],
    ),
  },
  {
    id: "telegram",
    name: "Telegram AI assistant",
    description: "A Telegram message comes in. Your agent writes the reply.",
    input: { text: "Hello", chatId: "YOUR_CHAT_ID" },
    graph: graph(
      [
        {
          id: "start",
          kind: "telegramTrigger",
          label: "Incoming Telegram message",
          position: { x: 40, y: 180 },
          config: { credentialId: "" },
        },
        {
          id: "agent",
          kind: "agent",
          label: "Write a helpful reply",
          position: { x: 340, y: 180 },
          config: { agentId: "", input: { text: "{{input.text}}" } },
        },
        {
          id: "reply",
          kind: "telegram",
          label: "Reply on Telegram",
          position: { x: 650, y: 180 },
          config: {
            credentialId: "",
            chatId: "{{trigger.chatId}}",
            text: "{{nodes.agent}}",
          },
        },
      ],
      [
        { id: "s-a", source: "start", target: "agent" },
        { id: "a-r", source: "agent", target: "reply" },
      ],
    ),
  },
  {
    id: "email",
    name: "Email triage",
    description: "New mail becomes an agent task, then a structured record.",
    input: { subject: "Support request", text: "Please help" },
    graph: graph(
      [
        {
          id: "start",
          kind: "emailTrigger",
          label: "New email",
          position: { x: 40, y: 180 },
          config: { credentialId: "", mailbox: "INBOX" },
        },
        {
          id: "agent",
          kind: "agent",
          label: "Classify the email",
          position: { x: 340, y: 180 },
          config: { agentId: "", input: { text: "{{input.text}}" } },
        },
        {
          id: "record",
          kind: "transform",
          label: "Prepare triage record",
          position: { x: 650, y: 180 },
          config: {
            values: {
              subject: "{{trigger.subject}}",
              classification: "{{nodes.agent}}",
            },
          },
        },
      ],
      [
        { id: "s-a", source: "start", target: "agent" },
        { id: "a-r", source: "agent", target: "record" },
      ],
    ),
  },
];
