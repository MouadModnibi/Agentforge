import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/workflows/serverless", () => ({
  runServerless: vi.fn(),
  serverlessEnabled: vi.fn(() => true),
}));
import { after } from "next/server";
import { POST } from "@/app/api/automation/tick/route";
import { serverlessEnabled, runServerless } from "@/lib/workflows/serverless";
const secret = "scheduler-test-secret-with-at-least-32-characters";
const req = (value?: string) =>
  new Request("https://app.example/api/automation/tick", {
    method: "POST",
    headers: value ? { authorization: value } : {},
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  vi.mocked(serverlessEnabled).mockReturnValue(true);
});
afterEach(() => vi.unstubAllEnvs());
it("rejects anonymous and incorrect scheduler credentials without scheduling work", async () => {
  expect((await POST(req())).status).toBe(401);
  expect((await POST(req("Bearer wrong"))).status).toBe(401);
  expect(after).not.toHaveBeenCalled();
});
it("fails closed when no strong scheduler secret is configured", async () => {
  vi.stubEnv("CRON_SECRET", "short");
  expect((await POST(req("Bearer short"))).status).toBe(401);
  expect(after).not.toHaveBeenCalled();
});
it("acknowledges before polling so the scheduler's 30s request cap is respected", async () => {
  const response = await POST(req(`Bearer ${secret}`));
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ accepted: true });
  expect(runServerless).not.toHaveBeenCalled();
  const callback = vi.mocked(after).mock.calls[0][0] as () => Promise<void>;
  await callback();
  expect(runServerless).toHaveBeenCalledOnce();
});
it("does not start a second runtime when the dedicated worker is selected", async () => {
  vi.mocked(serverlessEnabled).mockReturnValue(false);
  expect((await POST(req(`Bearer ${secret}`))).status).toBe(409);
  expect(after).not.toHaveBeenCalled();
});
