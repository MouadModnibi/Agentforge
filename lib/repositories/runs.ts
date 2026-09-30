import { db, runMigrations } from "@/lib/db/client";
import { runs, agents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Run } from "@/lib/schemas/run";

let migrated = false;
function ensureMigrated() {
  if (!migrated) {
    runMigrations();
    migrated = true;
  }
}

function parseRun(row: typeof runs.$inferSelect): Run {
  return {
    id: row.id,
    agentId: row.agentId,
    source: row.source as "playground" | "api",
    input: JSON.parse(row.input),
    output: row.output ? JSON.parse(row.output) : null,
    valid: row.valid === null ? null : Boolean(row.valid),
    trace: row.trace ? JSON.parse(row.trace) : null,
    usage: row.usage ? JSON.parse(row.usage) : null,
    llmRequestCount: row.llmRequestCount,
    durationMs: row.durationMs,
    error: row.error,
    createdAt: new Date(row.createdAt),
  };
}

export const runsRepository = {
  async create(data: {
    agentId: string;
    source: "playground" | "api";
    input: Record<string, unknown>;
    output?: unknown;
    valid?: boolean;
    trace?: unknown[];
    usage?: Record<string, number>;
    llmRequestCount: number;
    durationMs?: number;
    error?: string;
  }): Promise<Run> {
    ensureMigrated();
    const id = uuidv4();
    const now = Date.now();

    await db.insert(runs).values({
      id,
      agentId: data.agentId,
      source: data.source,
      input: JSON.stringify(data.input),
      output: data.output !== undefined ? JSON.stringify(data.output) : null,
      valid: data.valid !== undefined ? data.valid : null,
      trace: data.trace ? JSON.stringify(data.trace) : null,
      usage: data.usage ? JSON.stringify(data.usage) : null,
      llmRequestCount: data.llmRequestCount,
      durationMs: data.durationMs ?? null,
      error: data.error ?? null,
      createdAt: now,
    });

    // Increment agent runs count
    const agentRow = await db.select({ runsCount: agents.runsCount }).from(agents).where(eq(agents.id, data.agentId)).limit(1);
    if (agentRow[0]) {
      await db.update(agents).set({ runsCount: agentRow[0].runsCount + 1 }).where(eq(agents.id, data.agentId));
    }

    return (await this.findById(id))!;
  },

  async findById(id: string): Promise<Run | null> {
    ensureMigrated();
    const rows = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    return rows[0] ? parseRun(rows[0]) : null;
  },

  async findByAgent(agentId: string, limit = 50): Promise<Run[]> {
    ensureMigrated();
    const rows = await db.select().from(runs)
      .where(eq(runs.agentId, agentId))
      .orderBy(desc(runs.createdAt))
      .limit(limit);
    return rows.map(parseRun);
  },
};
