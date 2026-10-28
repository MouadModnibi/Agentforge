import { z } from "zod";
import { createHmac, randomUUID } from "node:crypto";
import { safeEqual } from "@/lib/security/adminAuth";
import { FormConfig } from "./form-config";
export { FormConfig } from "./form-config";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function signature(value: string) {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Configure APP_SECRET for published forms");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function formToken(id: string, revision: number) {
  const value = Buffer.from(
    JSON.stringify({
      id,
      revision,
      expires: Date.now() + 3600000,
      nonce: randomUUID(),
    }),
  ).toString("base64url");
  return `${value}.${signature(value)}`;
}
export function verifyFormToken(
  token: string,
  id: string,
  revision: number,
): string {
  const [value, mac, extra] = token.split(".");
  if (!value || !mac || extra || !safeEqual(mac, signature(value)))
    throw new Error("Invalid form token. Reload the form.");
  const payload = JSON.parse(Buffer.from(value, "base64url").toString());
  if (
    payload.id !== id ||
    payload.revision !== revision ||
    payload.expires < Date.now() ||
    typeof payload.nonce !== "string"
  )
    throw new Error("Form expired or changed. Reload the form.");
  return payload.nonce;
}
export function formInput(
  config: z.infer<typeof FormConfig>,
  values: URLSearchParams,
) {
  const input: Record<string, string> = {};
  for (const field of config.fields) {
    const value = values.get(field.name) ?? "";
    if (
      values.getAll(field.name).length > 1 ||
      value.length > 10000 ||
      (field.required && !value.trim())
    )
      throw new Error(`Check ${field.label}.`);
    if (value && field.type === "email" && !z.email().safeParse(value).success)
      throw new Error(`Check ${field.label}.`);
    input[field.name] = value;
  }
  return input;
}
export function renderForm(
  id: string,
  revision: number,
  config: z.infer<typeof FormConfig>,
  validation?: { message: string; values: URLSearchParams },
) {
  const fields = config.fields
    .map(
      (f) =>
        `<label for="${f.name}">${escapeHtml(f.label)}${f.required ? " *" : ""}</label>${f.type === "textarea" ? `<textarea id="${f.name}" name="${f.name}" rows="8"` : `<input id="${f.name}" name="${f.name}" type="${f.type}" value="${escapeHtml(validation?.values.get(f.name)?.slice(0, 10000) ?? "")}"`} maxlength="10000" ${validation ? 'aria-describedby="form-error" aria-invalid="true"' : ""} ${f.required ? "required" : ""}>${f.type === "textarea" ? `${escapeHtml(validation?.values.get(f.name)?.slice(0, 10000) ?? "")}</textarea>` : ""}`,
    )
    .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(config.title)} · m8m</title><style>body{font:16px/1.6 system-ui;background:#14171b;color:#f1f3f5;max-width:620px;margin:48px auto;padding:24px}label{display:block;margin-top:18px}input,textarea,button{box-sizing:border-box;width:100%;padding:12px;border:1px solid #66717d;border-radius:6px;background:#1c2127;color:inherit;font:inherit}textarea{resize:none}button{margin-top:24px;background:#b8d2e8;color:#14171b;cursor:pointer}:focus-visible{outline:3px solid #e8bf66;outline-offset:3px}</style><main><p>m8m · Published form</p><h1>${escapeHtml(config.title)}</h1><p>Submitting sends your answers to the form owner and starts their workflow. Do not enter passwords or sensitive information.</p>${validation ? `<p id="form-error" role="alert">${escapeHtml(validation.message)}</p>` : ""}<form novalidate method="post" action="/api/workflow-forms/${encodeURIComponent(id)}"><input type="hidden" name="token" value="${formToken(id, revision)}">${fields}<button type="submit">Send request</button></form></main></html>`;
}
