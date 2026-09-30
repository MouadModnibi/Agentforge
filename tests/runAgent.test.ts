import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig } from "@/lib/schemas/agent";

// ---- Mock heavy dependencies before importing runAgent ----

vi.mock("@/lib/providers", () => ({
  getProvider: () => ({
    getModel: () => "mock-model-instance",
  }),
}));

vi.mock("@/lib/providers/models", () => ({
  getModel: () => ({
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  }),
}));

vi.mock("@/lib/runtime/llmQueue", () => ({
  enqueueLLMCall: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/lib/runtime/withRateLimitHandling", () => ({
  withRateLimitHandling: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/lib/runtime/toolRegistry", () => ({
  buildExternalApiTools: () => [],
}));

// Mock generateText from ai SDK
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
    tool: (def: unknown) => def,
    // isStepCount must be exported so runAgent can import it
    isStepCount: (n: number) => () => false,
  };
});

import { runAgent, setServerSandbox } from "@/lib/runtime/runAgent";
import { generateText } from "ai";

const mockGenerateText = vi.mocked(generateText);

const baseConfig: AgentConfig = {
  model: "gemini-2.0-flash",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: "You are a helpful assistant.",
  inputParams: [],
  outputFormat: "json",
  outputSchema: '{"type":"object","properties":{"result":{"type":"string"}},"required":["result"]}',
  strictValidation: false,
  maxIterations: 3,
  repairRetries: 0,
  timeoutMs: 30000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAgent – happy path", () => {
  it("returns valid output for JSON format", async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"result":"hello"}',
      usage: { inputTokens: 10, outputTokens: 5 },
      steps: undefined,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgent({
      agentId: "test-id",
      config: baseConfig,
      input: {},
      resources: [],
    });

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.output).toEqual({ result: "hello" });
    expect(result.llmRequestCount).toBe(1);
  });

  it("tracks usage tokens", async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"result":"ok"}',
      usage: { inputTokens: 100, outputTokens: 50 },
      steps: undefined,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgent({
      agentId: "test-id",
      config: baseConfig,
      input: {},
      resources: [],
    });

    expect(result.usage.promptTokens).toBe(100);
    expect(result.usage.completionTokens).toBe(50);
    expect(result.usage.totalTokens).toBe(150);
  });

  it("returns invalid output when JSON is malformed", async () => {
    mockGenerateText.mockResolvedValue({
      text: "not json at all",
      usage: { inputTokens: 10, outputTokens: 5 },
      steps: undefined,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgent({
      agentId: "test-id",
      config: { ...baseConfig, repairRetries: 0 },
      input: {},
      resources: [],
    });

    expect(result.valid).toBe(false);
  });

  it("passes text format without validation", async () => {
    mockGenerateText.mockResolvedValue({
      text: "Some text response",
      usage: { inputTokens: 10, outputTokens: 5 },
      steps: undefined,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgent({
      agentId: "test-id",
      config: { ...baseConfig, outputFormat: "text" },
      input: {},
      resources: [],
    });

    expect(result.valid).toBe(true);
    expect(result.output).toBe("Some text response");
  });
});

describe("runAgent – repair loop", () => {
  it("retries on JSON validation failure when repairRetries > 0", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: "bad json",
        usage: { inputTokens: 10, outputTokens: 5 },
        steps: undefined,
      } as unknown as Awaited<ReturnType<typeof generateText>>)
      .mockResolvedValueOnce({
        text: '{"result":"fixed"}',
        usage: { inputTokens: 10, outputTokens: 5 },
        steps: undefined,
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgent({
      agentId: "test-id",
      config: { ...baseConfig, repairRetries: 1 },
      input: {},
      resources: [],
    });

    expect(result.valid).toBe(true);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("does not retry when repairRetries is 0 and strictValidation is false", async () => {
    mockGenerateText.mockResolvedValue({
      text: "bad json",
      usage: { inputTokens: 10, outputTokens: 5 },
      steps: undefined,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await runAgent({
      agentId: "test-id",
      config: { ...baseConfig, repairRetries: 0, strictValidation: false },
      input: {},
      resources: [],
    });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });
});

describe("runAgent – timeout", () => {
  it("returns timeout error when agent exceeds timeoutMs", async () => {
    mockGenerateText.mockImplementation(
      () => new Promise((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" })), 50);
      })
    );

    const result = await runAgent({
      agentId: "test-id",
      config: { ...baseConfig, timeoutMs: 10 },
      input: {},
      resources: [],
    });

    expect(result.error).toBeDefined();
    expect(result.valid).toBe(false);
  }, 5000);
});

describe("runAgent – error handling", () => {
  it("captures unexpected errors and returns them", async () => {
    mockGenerateText.mockRejectedValue(new Error("Unexpected LLM failure"));

    const result = await runAgent({
      agentId: "test-id",
      config: baseConfig,
      input: {},
      resources: [],
    });

    expect(result.error).toContain("Unexpected LLM failure");
    expect(result.valid).toBe(false);
  });
});

describe("runAgent – trace", () => {
  it("always includes prompt and output trace steps", async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"result":"ok"}',
      usage: { inputTokens: 10, outputTokens: 5 },
      steps: undefined,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgent({
      agentId: "test-id",
      config: baseConfig,
      input: { name: "test" },
      resources: [],
    });

    const types = result.trace.map((s) => s.type);
    expect(types).toContain("prompt");
    expect(types).toContain("llm_call");
    expect(types).toContain("output");
  });
});
