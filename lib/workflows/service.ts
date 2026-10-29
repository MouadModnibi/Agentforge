import { agentsRepository } from "@/lib/repositories/agents";
import { workflowStore, StoreError } from "./store";
import { validateGraph } from "./graph";
import type { WorkflowGraph } from "./schema";
import { redactSecrets } from "@/lib/security/redaction";
import { accountModelKey } from "@/lib/security/accounts";
export async function validateReferences(graph: WorkflowGraph) {
  const errors = validateGraph(graph);
  const credentials = await workflowStore.credentials();
  for (const n of graph.nodes) {
    if (["agent", "customTool"].includes(n.kind)) {
      const a = await agentsRepository.findById(String(n.config.agentId));
      if (!a) errors.push(`${n.label}: selected agent no longer exists.`);
      else if (n.kind === "customTool" && !a.customTool)
        errors.push(`${n.label}: selected agent has no custom tool.`);
    }
    if (n.config.credentialId) {
      const expected = n.kind.startsWith("telegram")
        ? "telegram"
        : n.kind.startsWith("email")
          ? "email"
          : n.kind.startsWith("x")
            ? "x"
            : n.kind === "discord"
              ? "discord"
              : "http";
      if (
        !credentials.some(
          (c) => c.id === n.config.credentialId && c.kind === expected,
        )
      )
        errors.push(`${n.label}: select a ${expected} credential.`);
    }
  }
  return errors;
}
export async function assertExecutable(graph: WorkflowGraph) {
  const errors = await validateReferences(graph);
  if (errors.length) throw new StoreError(errors.join(" "), 422);
}
export async function redact(value: unknown): Promise<unknown> {
  const secrets = (
    await Promise.all(
      (await workflowStore.credentials()).map(async (c) => {
        try {
          return Object.entries(await workflowStore.credential(c.id))
            .filter(
              ([k, v]) =>
                v.length >= 4 &&
                (c.kind === "http" ||
                  c.kind === "discord" ||
                  /token|secret|password/i.test(k)),
            )
            .flatMap(([, v]) =>
              c.kind === "discord" ? [v, v.split("/").at(-1) ?? v] : [v],
            );
        } catch {
          return [];
        }
      }),
    )
  ).flat();
  const modelKey = await accountModelKey();
  if (modelKey) secrets.push(modelKey);
  return redactSecrets(value, secrets);
}
