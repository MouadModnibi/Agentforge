import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["draft", "active"] }).notNull().default("draft"),
  schemaVersion: integer("schema_version").notNull().default(1),
  config: text("config").notNull().default("{}"), // JSON
  customTool: text("custom_tool"), // JSON nullable
  externalApis: text("external_apis").notNull().default("[]"), // JSON array
  apiKeyHash: text("api_key_hash"),
  runsCount: integer("runs_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),   // Unix ms, plain integer
  updatedAt: integer("updated_at").notNull(),   // Unix ms, plain integer
});

export const agentVersions = sqliteTable("agent_versions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshot: text("snapshot").notNull(), // JSON
  createdAt: integer("created_at").notNull(),
});

export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["playground", "api"] }).notNull(),
  input: text("input").notNull(), // JSON
  output: text("output"), // JSON or text
  valid: integer("valid", { mode: "boolean" }),
  trace: text("trace"), // JSON
  usage: text("usage"), // JSON
  llmRequestCount: integer("llm_request_count").notNull().default(0),
  durationMs: integer("duration_ms"),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
});
