import { generateText, tool, isStepCount } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import { getProvider } from "@/lib/providers";
import { getModel } from "@/lib/providers/models";
import { buildPrompt } from "./buildPrompt";
import { validateOutput, buildRepairPrompt } from "./outputValidator";
import { buildExternalApiTools, type ToolDefinition } from "./toolRegistry";
import { withRateLimitHandling } from "./withRateLimitHandling";
import { enqueueLLMCall } from "./llmQueue";
import type { AgentConfig, ExternalApi, CustomTool } from "@/lib/schemas/agent";

export interface Resource {
  id: string;
  name: string;
  content: string;
  mimeType: string;
  size: number;
}

export interface RunAgentOptions {
  agentId: string;
  config: AgentConfig;
  input: Record<string, unknown>;
  resources: Resource[];
  customTool?: CustomTool | null;
  externalApis?: ExternalApi[];
  source?: "playground" | "api";
}

export interface TraceStep {
  type: "prompt" | "llm_call" | "tool_call" | "tool_result" | "repair" | "output";
  data: unknown;
  timestamp: number;
  durationMs?: number;
}

export interface RunAgentResult {
  output: unknown;
  valid: boolean;
  trace: TraceStep[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  llmRequestCount: number;
  durationMs: number;
  error?: string;
}

/** CodeSandbox interface – the server implementation is wired via /lib/sandbox */
export interface CodeSandbox {
  run(
    code: string,
    args: Record<string, unknown>,
    opts: { timeoutMs: number }
  ): Promise<unknown>;
}

let _serverSandbox: CodeSandbox | null = null;
export function setServerSandbox(sandbox: CodeSandbox) {
  _serverSandbox = sandbox;
}

function makeTool(def: ToolDefinition) {
  return tool({
    description: def.description,
    inputSchema: z.object({ query: z.string().describe("Query or request data").optional() }),
    execute: async (args: Record<string, unknown>) => {
      return def.execute(args);
    },
  });
}

function makeCustomTool(ct: CustomTool, sandbox: CodeSandbox, timeoutMs: number) {
  let paramSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  try {
    const parsed = JSON.parse(ct.parameterSchema) as {
      properties?: Record<string, { type?: string; description?: string }>;
    };
    const props: Record<string, z.ZodTypeAny> = {};
    for (const [k, v] of Object.entries(parsed.properties ?? {})) {
      if (v.type === "number") props[k] = z.number().describe(v.description ?? k);
      else if (v.type === "boolean") props[k] = z.boolean().describe(v.description ?? k);
      else props[k] = z.string().describe(v.description ?? k).optional();
    }
    paramSchema = z.object(props);
  } catch {
    paramSchema = z.object({});
  }

  return tool({
    description: ct.description,
    inputSchema: paramSchema,
    execute: async (args: Record<string, unknown>) => {
      return sandbox.run(ct.code, args, { timeoutMs });
    },
  });
}

export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const startTime = Date.now();
  const trace: TraceStep[] = [];
  let llmRequestCount = 0;
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const { config, input, resources, externalApis = [], customTool } = opts;

  // Enforce timeout
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), config.timeoutMs);

  try {
    // Build prompt
    const { systemPrompt, userMessage } = buildPrompt({ config, input, resources });

    trace.push({
      type: "prompt",
      data: { systemPrompt, userMessage, resourceCount: resources.length },
      timestamp: Date.now(),
    });

    const provider = getProvider();
    const modelDef = getModel(config.model);
    const model = provider.getModel(config.model);

    // Build tools
    const toolDefs: ToolDefinition[] = buildExternalApiTools(externalApis);
    const allTools: ToolSet = {};

    for (const def of toolDefs) {
      allTools[def.name] = makeTool(def);
    }

    // Add custom tool if sandbox is available
    if (customTool && _serverSandbox) {
      allTools[customTool.name] = makeCustomTool(customTool, _serverSandbox, Math.min(config.timeoutMs, 5000));
    } else if (customTool && !_serverSandbox) {
      // Custom tool requested but sandbox unavailable on this path — note in trace
      trace.push({
        type: "tool_call",
        data: { warning: `Custom tool '${customTool.name}' is unavailable: server sandbox not configured. Tool calls to it will be skipped.` },
        timestamp: Date.now(),
      });
    }

    const hasTools = Object.keys(allTools).length > 0;
    const supportsToolsWithStructuredOutput = modelDef?.capabilities.supportsToolsWithStructuredOutput ?? false;
    const tools = hasTools ? allTools : undefined;

    let rawOutput = "";

    // Phase 1: Main generation (with tools if any)
    const llmCallStart = Date.now();

    const result = await enqueueLLMCall(() =>
      withRateLimitHandling(() => {
        llmRequestCount++;
        return generateText({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
          tools: tools,
          stopWhen: isStepCount(config.maxIterations),
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          abortSignal: abortController.signal,
        });
      })
    );

    const usage = result.usage as { inputTokens?: number; outputTokens?: number } | undefined;
    totalUsage.promptTokens += usage?.inputTokens ?? 0;
    totalUsage.completionTokens += usage?.outputTokens ?? 0;
    totalUsage.totalTokens += (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);

    // Count actual steps (each tool-call round = 1 LLM request)
    const steps = (result as { steps?: unknown[] }).steps;
    if (steps && steps.length > 0) {
      llmRequestCount = steps.length;
    }

    trace.push({
      type: "llm_call",
      data: {
        model: config.model,
        usage: result.usage,
        steps: steps?.map((s: unknown) => {
          const step = s as Record<string, unknown>;
          return { text: step.text, toolCalls: step.toolCalls, toolResults: step.toolResults, usage: step.usage };
        }),
      },
      timestamp: llmCallStart,
      durationMs: Date.now() - llmCallStart,
    });

    rawOutput = result.text;

    // Phase 2: Formatting pass if tools were used and model doesn't support tools+JSON
    if (hasTools && !supportsToolsWithStructuredOutput && config.outputFormat === "json") {
      const formatStart = Date.now();
      const repairResult = await enqueueLLMCall(() =>
        withRateLimitHandling(() => {
          llmRequestCount++;
          return generateText({
            model,
            system: `You are a JSON formatter. Convert the following text to valid JSON matching this schema:\n${config.outputSchema}\nRespond with ONLY the JSON object, no other text.`,
            messages: [{ role: "user", content: rawOutput }],
            temperature: 0,
            maxOutputTokens: config.maxTokens,
            abortSignal: abortController.signal,
          });
        })
      );
      const ru = repairResult.usage as { inputTokens?: number; outputTokens?: number } | undefined;
      totalUsage.promptTokens += ru?.inputTokens ?? 0;
      totalUsage.completionTokens += ru?.outputTokens ?? 0;
      totalUsage.totalTokens += (ru?.inputTokens ?? 0) + (ru?.outputTokens ?? 0);
      trace.push({
        type: "repair",
        data: { reason: "formatting_pass", input: rawOutput, output: repairResult.text },
        timestamp: formatStart,
        durationMs: Date.now() - formatStart,
      });
      rawOutput = repairResult.text;
    }

    // Validate output
    let validationResult = validateOutput(rawOutput, config.outputFormat, config.outputSchema);

    // Repair loop — only if strictValidation is on OR repairRetries > 0
    const shouldRepair = config.outputFormat === "json" &&
      !validationResult.valid &&
      (config.strictValidation || config.repairRetries > 0);

    if (shouldRepair) {
      let repairAttempts = 0;
      const maxRepairs = config.strictValidation
        ? Math.max(config.repairRetries, 1)
        : config.repairRetries;

      while (!validationResult.valid && repairAttempts < maxRepairs) {
        repairAttempts++;
        const repairPrompt = buildRepairPrompt(rawOutput, validationResult.errors);
        trace.push({
          type: "repair",
          data: { attempt: repairAttempts, errors: validationResult.errors },
          timestamp: Date.now(),
        });

        const repairResult = await enqueueLLMCall(() =>
          withRateLimitHandling(() => {
            llmRequestCount++;
            return generateText({
              model,
              messages: [{ role: "user", content: repairPrompt }],
              temperature: 0,
              maxOutputTokens: config.maxTokens,
              abortSignal: abortController.signal,
            });
          })
        );
        const ru = repairResult.usage as { inputTokens?: number; outputTokens?: number } | undefined;
        totalUsage.promptTokens += ru?.inputTokens ?? 0;
        totalUsage.completionTokens += ru?.outputTokens ?? 0;
        totalUsage.totalTokens += (ru?.inputTokens ?? 0) + (ru?.outputTokens ?? 0);

        rawOutput = repairResult.text;
        validationResult = validateOutput(rawOutput, config.outputFormat, config.outputSchema);
      }
    }

    trace.push({
      type: "output",
      data: { raw: rawOutput, valid: validationResult.valid, errors: validationResult.errors },
      timestamp: Date.now(),
    });

    return {
      output: validationResult.parsed ?? rawOutput,
      valid: validationResult.valid,
      trace,
      usage: totalUsage,
      llmRequestCount,
      durationMs: Date.now() - startTime,
    };

  } catch (err) {
    const isTimeout = abortController.signal.aborted;
    const message = isTimeout
      ? `Agent timed out after ${config.timeoutMs / 1000}s`
      : err instanceof Error ? err.message : String(err);

    trace.push({ type: "output", data: { error: message }, timestamp: Date.now() });
    return {
      output: null,
      valid: false,
      trace,
      usage: totalUsage,
      llmRequestCount,
      durationMs: Date.now() - startTime,
      error: message,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
