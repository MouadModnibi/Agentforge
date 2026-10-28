import { describe, it, expect, vi, afterEach } from "vitest";
import {
  FormConfig,
  renderForm,
  formToken,
  verifyFormToken,
  formInput,
} from "@/lib/workflows/forms";
afterEach(() => vi.unstubAllEnvs());
const config = FormConfig.parse({
  title: "Ask <IT>",
  fields: [
    { name: "email", label: "Email", type: "email", required: true },
    { name: "text", label: "Message", type: "textarea" },
  ],
});
describe("published HTML forms", () => {
  it("escapes owner content and only generates safe input elements", () => {
    vi.stubEnv("APP_SECRET", "test-form-secret-at-least-32-characters");
    const html = renderForm("id", 1, config);
    expect(html).toContain("Ask &lt;IT&gt;");
    expect(html).toContain('method="post"');
    expect(html).not.toContain("<script");
  });
  it("binds submissions to workflow, active revision and expiry", () => {
    vi.stubEnv("APP_SECRET", "test-form-secret-at-least-32-characters");
    const token = formToken("one", 2);
    expect(verifyFormToken(token, "one", 2)).toBeTruthy();
    expect(() => verifyFormToken(token, "other", 2)).toThrow();
    expect(() => verifyFormToken(token, "one", 3)).toThrow();
    expect(() => verifyFormToken(token + "x", "one", 2)).toThrow();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600001);
    expect(() => verifyFormToken(token, "one", 2)).toThrow("expired");
    vi.restoreAllMocks();
  });
  it("validates required fields and emails, excludes undeclared fields", () => {
    expect(() =>
      formInput(config, new URLSearchParams("email=wrong")),
    ).toThrow();
    expect(() => formInput(config, new URLSearchParams())).toThrow();
    expect(
      formInput(
        config,
        new URLSearchParams("email=a%40example.com&text=hello&admin=true"),
      ),
    ).toEqual({ email: "a@example.com", text: "hello" });
  });
  it("rejects duplicate or prototype fields and raw HTML field types", () => {
    expect(
      FormConfig.safeParse({
        title: "Hi",
        fields: [{ name: "constructor", label: "X" }],
      }).success,
    ).toBe(false);
    expect(
      FormConfig.safeParse({
        title: "Hi",
        fields: [{ name: "a", label: "X", type: "html" }],
      }).success,
    ).toBe(false);
    expect(
      FormConfig.safeParse({
        title: "Hi",
        fields: [
          { name: "a", label: "X" },
          { name: "a", label: "Y" },
        ],
      }).success,
    ).toBe(false);
  });
});
