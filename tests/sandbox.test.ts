import { describe, it, expect } from "vitest";
import { SandboxError, ServerSandbox } from "@/lib/sandbox/customToolRunner";

describe("ServerSandbox", () => {
  const nativeSandbox = new ServerSandbox();
  it.skipIf(!nativeSandbox.isAvailable())("copies asynchronous results out of a real isolate", async () => {
    await expect(nativeSandbox.run("async function run(args) { return { doubled: await Promise.resolve(args.n * 2), process: typeof process, fetch: typeof fetch }; }", {n: 4}, {timeoutMs: 1000})).resolves.toEqual({doubled: 8, process: "undefined", fetch: "undefined"});
  });
  it.skipIf(!nativeSandbox.isAvailable())("terminates an infinite loop", async () => {
    await expect(nativeSandbox.run("function run() { while(true) {} }", {}, {timeoutMs: 100})).rejects.toMatchObject({code: "TIMEOUT"});
  });
  it.skipIf(!nativeSandbox.isAvailable())("bounds a promise that never settles", async () => {
    await expect(nativeSandbox.run("async function run() { await new Promise(() => {}); }", {}, {timeoutMs: 100})).rejects.toMatchObject({code: "TIMEOUT"});
  });
  it("throws SandboxError with UNAVAILABLE code when ivm missing", async () => {
    const sandbox = new ServerSandbox();
    // isolated-vm is not installed in the test environment — sandbox should be unavailable
    // OR we force it unavailable
    (sandbox as unknown as { available: boolean }).available = false;
    (sandbox as unknown as { ivm: null }).ivm = null;

    await expect(
      sandbox.run("async function run() {}", {}, { timeoutMs: 1000 })
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("isAvailable() returns false when ivm is null", () => {
    const sandbox = new ServerSandbox();
    (sandbox as unknown as { available: boolean }).available = false;
    expect(sandbox.isAvailable()).toBe(false);
  });

  it("isAvailable() returns true when ivm is set", () => {
    const sandbox = new ServerSandbox();
    // Manually set available to test the flag
    (sandbox as unknown as { available: boolean }).available = true;
    (sandbox as unknown as { ivm: Record<string, unknown> }).ivm = { Isolate: class {} };
    expect(sandbox.isAvailable()).toBe(true);
  });
});

describe("SandboxError", () => {
  it("has the correct name", () => {
    const err = new SandboxError("test", "TIMEOUT");
    expect(err.name).toBe("SandboxError");
    expect(err.code).toBe("TIMEOUT");
    expect(err.message).toBe("test");
  });

  it("defaults code to RUNTIME_ERROR", () => {
    const err = new SandboxError("oops");
    expect(err.code).toBe("RUNTIME_ERROR");
  });

  it("is instanceof Error", () => {
    const err = new SandboxError("x");
    expect(err instanceof Error).toBe(true);
  });
});
