import { AsyncLocalStorage } from "node:async_hooks";

// Only server code establishes this context, after session/capability verification.
const context = new AsyncLocalStorage<string>();
export function withOwner<T>(id: string, fn: () => T): T {
  if (!id) throw new Error("An account is required");
  return context.run(id, fn);
}
export function ownerId(): string {
  const id = context.getStore();
  if (!id) throw new Error("An account is required");
  return id;
}
