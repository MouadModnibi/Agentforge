import { withUser } from "@/lib/security/routeAuth";
import { accountModelKey, saveModelKey } from "@/lib/security/accounts";
import { ok, body, failure } from "@/lib/workflows/api";
import { z } from "zod";
export const GET = withUser(async function GET(_request: Request) {
  return ok({ hasGeminiKey: !!(await accountModelKey()) });
});
export const PATCH = withUser(async function PATCH(request: Request) {
  try {
    const data = z
      .object({ geminiKey: z.string().trim().max(256) })
      .parse(await body(request));
    await saveModelKey(data.geminiKey);
    return ok({ hasGeminiKey: !!data.geminiKey });
  } catch (e) {
    return failure(e);
  }
});
