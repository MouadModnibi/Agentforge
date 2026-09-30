/**
 * CodeSandbox implementations.
 *
 * Browser-side: BrowserWorkerSandbox – runs code in a Web Worker with a 5 s timeout.
 * Server-side:  ServerSandbox – tries isolated-vm; falls back to "unavailable" so callers
 *               can surface a clear message instead of executing untrusted code unsafely.
 *
 * The interface intentionally mirrors runAgent.CodeSandbox so it can be injected there.
 */

import type { CodeSandbox } from "@/lib/runtime/runAgent";

// ── Shared error ────────────────────────────────────────────────────────────

export class SandboxError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TIMEOUT"
      | "RUNTIME_ERROR"
      | "NETWORK_BLOCKED"
      | "UNAVAILABLE" = "RUNTIME_ERROR"
  ) {
    super(message);
    this.name = "SandboxError";
  }
}

// ── Server sandbox (Node.js only) ───────────────────────────────────────────

/**
 * Attempts to use isolated-vm. If the package is absent, marks itself unavailable
 * so API run handlers can surface a clear message instead of crashing.
 */
export class ServerSandbox implements CodeSandbox {
  private available: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ivm: any = null;

  constructor() {
    try {
      // Dynamic require – isolated-vm is optional; absence is handled gracefully.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.ivm = require("isolated-vm");
      this.available = true;
    } catch {
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async run(
    code: string,
    args: Record<string, unknown>,
    opts: { timeoutMs: number }
  ): Promise<unknown> {
    if (!this.available || !this.ivm) {
      throw new SandboxError(
        "Server-side code sandbox (isolated-vm) is not installed. " +
          "Custom tools are unavailable for API runs. " +
          "Install isolated-vm or test via the Playground instead.",
        "UNAVAILABLE"
      );
    }

    const isolate = new this.ivm.Isolate({ memoryLimit: 32 }); // 32 MB
    const context = await isolate.createContext();
    const jail = context.global;

    // Inject serialisable args only – no Node APIs
    await jail.set("__args__", new this.ivm.ExternalCopy(args).copyInto());

    // Wrap user code: expect an async function named `run`
    const wrapped = `
      ${code}
      (async () => {
        const result = await run(__args__, {});
        return JSON.stringify(result === undefined ? null : result);
      })();
    `;

    try {
      const script = await isolate.compileScript(wrapped);
      const resultRef = await script.run(context, { timeout: opts.timeoutMs });
      const raw = await resultRef;
      return JSON.parse(typeof raw === "string" ? raw : "null");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("timeout")) {
        throw new SandboxError(`Tool timed out after ${opts.timeoutMs}ms`, "TIMEOUT");
      }
      throw new SandboxError(`Tool runtime error: ${msg}`, "RUNTIME_ERROR");
    } finally {
      isolate.dispose();
    }
  }
}

// Singleton – created lazily on first API run
let _serverSandbox: ServerSandbox | null = null;
export function getServerSandbox(): ServerSandbox {
  if (!_serverSandbox) _serverSandbox = new ServerSandbox();
  return _serverSandbox;
}

// ── Worker script source (inlined, used by BrowserWorkerSandbox) ────────────

/**
 * This string is turned into a Blob URL so no separate worker file is needed.
 * The worker receives { code, args, timeoutMs } and posts back { result } or { error }.
 *
 * Security limits inside the worker:
 *  - No DOM access (workers never have it)
 *  - fetch is allowed (browser provides it)
 *  - No require / process / fs
 *  - 5 s hard timeout via setTimeout → self.close()
 */
export const WORKER_SCRIPT = /* js */ `
self.onmessage = async function(e) {
  const { code, args, timeoutMs } = e.data;
  const timer = setTimeout(() => {
    self.postMessage({ error: 'TIMEOUT:Tool timed out after ' + timeoutMs + 'ms' });
    self.close();
  }, timeoutMs || 5000);

  try {
    // Build run function from user code
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('args', 'ctx', code + '\\nreturn run(args, ctx);');
    const result = await fn(args, { fetch: self.fetch?.bind(self) });
    clearTimeout(timer);
    self.postMessage({ result: result === undefined ? null : result });
  } catch(err) {
    clearTimeout(timer);
    self.postMessage({ error: 'RUNTIME_ERROR:' + (err && err.message ? err.message : String(err)) });
  }
};
`;

// ── Browser sandbox (client-side) ───────────────────────────────────────────

/**
 * Runs user code in a Blob-URL Web Worker. Safe to use in the browser Playground.
 * Not usable from Node (no Worker global).
 */
export class BrowserWorkerSandbox implements CodeSandbox {
  async run(
    code: string,
    args: Record<string, unknown>,
    opts: { timeoutMs: number }
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([WORKER_SCRIPT], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      const outerTimer = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(url);
        reject(new SandboxError(`Tool timed out after ${opts.timeoutMs}ms`, "TIMEOUT"));
      }, opts.timeoutMs + 500); // small grace beyond inner timer

      worker.onmessage = (e: MessageEvent<{ result?: unknown; error?: string }>) => {
        clearTimeout(outerTimer);
        worker.terminate();
        URL.revokeObjectURL(url);

        const { result, error } = e.data;
        if (error) {
          const [code, ...rest] = error.split(":");
          reject(
            new SandboxError(
              rest.join(":") || error,
              (code as SandboxError["code"]) ?? "RUNTIME_ERROR"
            )
          );
        } else {
          resolve(result);
        }
      };

      worker.onerror = (ev) => {
        clearTimeout(outerTimer);
        worker.terminate();
        URL.revokeObjectURL(url);
        reject(new SandboxError(ev.message || "Worker error", "RUNTIME_ERROR"));
      };

      worker.postMessage({ code, args, timeoutMs: opts.timeoutMs });
    });
  }
}
