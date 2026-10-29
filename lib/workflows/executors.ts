import { runAgent, setServerSandbox } from "@/lib/runtime/runAgent";
import { getServerSandbox } from "@/lib/sandbox/customToolRunner";
import { agentsRepository } from "@/lib/repositories/agents";
import { runsRepository } from "@/lib/repositories/runs";
import { guardedFetch, resolvePublicHost } from "@/lib/security/ssrfGuard";
import { workflowStore } from "./store";
import { resolveBindings } from "./graph";
import type { WorkflowNode } from "./schema";
import { discordWebhookUrl } from "./discord";
export interface ExecutionContext {
  input: unknown;
  trigger: unknown;
  nodes: Record<string, unknown>;
  signal: AbortSignal;
}
export interface ExecutorResult {
  output: unknown;
  branch?: string;
  usage?: Record<string, number>;
}
export type NodeExecutor = (
  node: WorkflowNode,
  ctx: ExecutionContext,
) => Promise<ExecutorResult>;
async function jsonResponse(response: Response) {
  const text = await response.text();
  if (!response.ok)
    throw new Error(`Remote service returned HTTP ${response.status}`);
  return response.headers.get("content-type")?.includes("json")
    ? JSON.parse(text)
    : text;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Inputs must resolve to an object");
  return value as Record<string, unknown>;
}
export const executeNode: NodeExecutor = async (node, ctx) => {
  ctx.signal.throwIfAborted();
  const c = object(resolveBindings(node.config, ctx));
  const credential = async (
    kind: "telegram" | "email" | "x" | "http" | "discord",
  ) => await workflowStore.credential(String(c.credentialId), kind);
  switch (node.kind) {
    case "manual":
    case "formTrigger":
    case "webhook":
    case "telegramTrigger":
    case "emailTrigger":
    case "xTrigger":
      return { output: ctx.trigger };
    case "transform":
      return { output: c.values };
    case "condition": {
      let result = false;
      switch (c.operator) {
        case "equals":
          result = JSON.stringify(c.value) === JSON.stringify(c.compare);
          break;
        case "notEquals":
          result = JSON.stringify(c.value) !== JSON.stringify(c.compare);
          break;
        case "contains":
          result = String(c.value).includes(String(c.compare));
          break;
        case "greaterThan":
          result = Number(c.value) > Number(c.compare);
          break;
        case "lessThan":
          result = Number(c.value) < Number(c.compare);
          break;
        case "exists":
          result = c.value !== undefined && c.value !== null && c.value !== "";
          break;
        default:
          throw new Error("Unknown condition operator");
      }
      return { output: ctx.input, branch: result ? "true" : "false" };
    }
    case "router":
      return {
        output: ctx.input,
        branch:
          Object.entries(object(c.cases)).find(
            ([, v]) => JSON.stringify(v) === JSON.stringify(c.value),
          )?.[0] ?? "default",
      };
    case "agent":
    case "gemini": {
      const agent =
        node.kind === "agent"
          ? await agentsRepository.findById(String(c.agentId))
          : null;
      if (node.kind === "agent" && !agent)
        throw new Error("Referenced agent no longer exists");
      const resources = agent
        ? await agentsRepository.getResources(agent.id)
        : [];
      setServerSandbox(getServerSandbox());
      const result = await runAgent({
        agentId: agent?.id ?? node.id,
        config: agent?.config ?? {
          model: String(c.model),
          systemPrompt: String(c.prompt),
          temperature: 0.7,
          maxTokens: 2048,
          inputParams: [],
          outputFormat: "text",
          outputSchema: "{}",
          strictValidation: false,
          maxIterations: 1,
          repairRetries: 0,
          timeoutMs: node.timeoutMs,
        },
        input:
          node.kind === "agent"
            ? object(c.input ?? ctx.input)
            : object(typeof ctx.input === "object" ? ctx.input : {}),
        resources,
        customTool: agent?.customTool,
        externalApis: agent?.externalApis,
        source: "api",
        signal: ctx.signal,
      });
      if (agent)
        await runsRepository.create({
          agentId: agent.id,
          source: "api",
          input: object(c.input ?? ctx.input),
          ...result,
        });
      if (result.error) throw new Error(result.error);
      if (!result.valid)
        throw new Error("Agent returned output that failed validation");
      return { output: result.output, usage: result.usage };
    }
    case "customTool": {
      const agent = await agentsRepository.findById(String(c.agentId));
      if (!agent?.customTool) throw new Error("This agent has no custom tool");
      const sandbox = getServerSandbox();
      if (!sandbox.isAvailable())
        throw new Error(
          "Custom tools require isolated-vm. See setup documentation.",
        );
      return {
        output: await sandbox.run(
          agent.customTool.code,
          object(c.args ?? ctx.input),
          { timeoutMs: node.timeoutMs },
        ),
      };
    }
    case "http": {
      const headers = Object.fromEntries(
        Object.entries(object(c.headers ?? {})).map(([k, v]) => [k, String(v)]),
      );
      if (c.credentialId) Object.assign(headers, await credential("http"));
      const response = await guardedFetch(String(c.url), {
        method: String(c.method),
        headers,
        body: c.method === "GET" ? undefined : JSON.stringify(c.body ?? {}),
        signal: ctx.signal,
      });
      return { output: await jsonResponse(response) };
    }
    case "telegram": {
      const secret = await credential("telegram");
      if (!/^\d+:[\w-]+$/.test(secret.botToken ?? ""))
        throw new Error("Invalid Telegram bot token");
      const response = await guardedFetch(
        `https://api.telegram.org/bot${secret.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: c.chatId, text: c.text }),
          signal: ctx.signal,
        },
      );
      return { output: await jsonResponse(response) };
    }
    case "discord": {
      const text = String(c.text ?? "");
      if (!text.trim() || text.length > 2000)
        throw new Error(
          "Discord message must contain 1 to 2000 characters. Shorten the Message field.",
        );
      const threadId = String(c.threadId ?? "").trim();
      if (threadId && !/^\d+$/.test(threadId))
        throw new Error("Discord thread ID must contain only digits.");
      const secret = await credential("discord");
      const url = new URL(discordWebhookUrl(secret.webhookUrl ?? ""));
      url.searchParams.set("wait", "true");
      if (threadId) url.searchParams.set("thread_id", threadId);
      let response: Response;
      try {
        response = await guardedFetch(url.toString(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: ctx.signal,
          body: JSON.stringify({
            content: text,
            allowed_mentions: {
              parse: [],
              users: [],
              roles: [],
              replied_user: false,
            },
          }),
        });
      } catch {
        ctx.signal.throwIfAborted();
        throw new Error(
          "Discord request failed. Check the saved webhook and network connection before retrying.",
        );
      }
      if (!response.ok)
        throw new Error(
          `Discord returned HTTP ${response.status}. ${response.status === 429 ? "Rate limit reached; wait before retrying." : "Check the saved webhook and channel access."}`,
        );
      // Return identifiers only. Never persist a webhook token or provider body.
      let message: { id?: unknown; channel_id?: unknown };
      try {
        message = await response.json();
      } catch {
        throw new Error(
          "Discord did not confirm the message. Check the channel before retrying.",
        );
      }
      if (
        typeof message?.id !== "string" ||
        typeof message?.channel_id !== "string"
      )
        throw new Error(
          "Discord did not confirm the message. Check the channel before retrying.",
        );
      return {
        output: { messageId: message.id, channelId: message.channel_id },
      };
    }
    case "email": {
      const secret = await credential("email");
      const address = await resolvePublicHost(secret.smtpHost);
      const { default: nodemailer } = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: address,
        tls: { servername: secret.smtpHost },
        port: Number(secret.smtpPort ?? 465),
        secure: secret.smtpPort !== "587",
        requireTLS: true,
        auth: { user: secret.user, pass: secret.password },
        connectionTimeout: 10000,
        socketTimeout: Math.min(node.timeoutMs, 30000),
      });
      const abort = () => transport.close();
      ctx.signal.addEventListener("abort", abort, { once: true });
      try {
        const result = await transport.sendMail({
          from: secret.from ?? secret.user,
          to: String(c.to),
          subject: String(c.subject),
          text: String(c.text),
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        ctx.signal.throwIfAborted();
        return {
          output: { messageId: result.messageId, accepted: result.accepted },
        };
      } finally {
        ctx.signal.removeEventListener("abort", abort);
        transport.close();
      }
    }
    case "x": {
      const secret = await credential("x");
      return {
        output: await jsonResponse(
          await guardedFetch("https://api.x.com/2/tweets", {
            method: "POST",
            headers: {
              authorization: `Bearer ${secret.accessToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ text: c.text }),
            signal: ctx.signal,
          }),
        ),
      };
    }
  }
};
