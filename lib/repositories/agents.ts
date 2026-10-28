import { ownerId } from "@/lib/security/owner";
import { db, runMigrations } from "@/lib/db/client";
import { agents, agentVersions, resources } from "@/lib/db/schema";
import { eq, desc, like, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { encryptSecret } from "@/lib/security/secrets";
import type {
  CreateAgent,
  UpdateAgent,
  Agent,
  AgentConfig,
  ExternalApi,
  CustomTool,
} from "@/lib/schemas/agent";

// Run migrations on first import
const ensureMigrated = runMigrations;

function parseAgent(row: typeof agents.$inferSelect): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as "draft" | "active",
    schemaVersion: row.schemaVersion,
    config: JSON.parse(row.config) as AgentConfig,
    customTool: row.customTool
      ? (JSON.parse(row.customTool) as CustomTool)
      : null,
    externalApis: JSON.parse(row.externalApis) as ExternalApi[],
    apiKeyHash: row.apiKeyHash,
    runsCount: row.runsCount,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/** Encrypt any header values marked with "raw:" prefix by the client */
function processExternalApiSecrets(
  apis: ExternalApi[],
  existing: ExternalApi[] = [],
): ExternalApi[] {
  return apis.map((api) => {
    const processedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(api.headers)) {
      if (v === "enc:[REDACTED]") {
        const saved = existing.find((a) => a.id === api.id)?.headers[k];
        if (!saved?.startsWith("enc:"))
          throw new Error("Secret placeholder has no stored value");
        processedHeaders[k] = saved;
      } else if (v.startsWith("raw:")) {
        processedHeaders[k] = `enc:${encryptSecret(v.slice(4))}`;
      } else {
        processedHeaders[k] = v;
      }
    }
    return { ...api, headers: processedHeaders };
  });
}

export const agentsRepository = {
  async findAll(opts?: {
    search?: string;
    status?: "draft" | "active";
  }): Promise<Agent[]> {
    await ensureMigrated();
    const conditions = [eq(agents.ownerId, ownerId())];
    if (opts?.search) conditions.push(like(agents.name, `%${opts.search}%`));
    if (opts?.status) conditions.push(eq(agents.status, opts.status));

    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(agents)
            .where(and(...conditions))
            .orderBy(desc(agents.updatedAt))
        : await db.select().from(agents).orderBy(desc(agents.updatedAt));

    return rows.map(parseAgent);
  },

  async findById(id: string): Promise<Agent | null> {
    await ensureMigrated();
    const rows = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId())))
      .limit(1);
    return rows[0] ? parseAgent(rows[0]) : null;
  },

  async create(data: CreateAgent): Promise<Agent> {
    await ensureMigrated();
    const now = Date.now();
    const id = uuidv4();
    const defaultConfig: AgentConfig = {
      model: process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash-lite",
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: "",
      inputParams: [],
      outputFormat: "json",
      outputSchema: "{}",
      strictValidation: false,
      maxIterations: 3,
      repairRetries: 1,
      timeoutMs: 30000,
    };

    const config = { ...defaultConfig, ...data.config };
    const externalApis = processExternalApiSecrets(data.externalApis || []);

    await db.insert(agents).values({
      id,
      ownerId: ownerId(),
      name: data.name,
      description: data.description || "",
      status: data.status || "draft",
      schemaVersion: 1,
      config: JSON.stringify(config),
      customTool: data.customTool ? JSON.stringify(data.customTool) : null,
      externalApis: JSON.stringify(externalApis),
      apiKeyHash: null,
      runsCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.findById(id))!;
  },

  async update(id: string, data: UpdateAgent): Promise<Agent | null> {
    await ensureMigrated();
    const existing = await this.findById(id);
    if (!existing) return null;

    const updatedConfig = data.config
      ? { ...existing.config, ...data.config }
      : existing.config;

    await db
      .update(agents)
      .set({
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        status: data.status ?? existing.status,
        config: JSON.stringify(updatedConfig),
        customTool:
          data.customTool !== undefined
            ? data.customTool
              ? JSON.stringify(data.customTool)
              : null
            : existing.customTool
              ? JSON.stringify(existing.customTool)
              : null,
        externalApis:
          data.externalApis !== undefined
            ? JSON.stringify(
                processExternalApiSecrets(
                  data.externalApis,
                  existing.externalApis,
                ),
              )
            : JSON.stringify(existing.externalApis),
        updatedAt: Date.now(),
      })
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId())));

    // Create version snapshot
    const versionRows = await db
      .select()
      .from(agentVersions)
      .where(eq(agentVersions.agentId, id))
      .orderBy(desc(agentVersions.version))
      .limit(1);
    const nextVersion = versionRows[0] ? versionRows[0].version + 1 : 1;

    await db.insert(agentVersions).values({
      id: uuidv4(),
      agentId: id,
      version: nextVersion,
      snapshot: JSON.stringify(await this.findById(id)),
      createdAt: Date.now(),
    });

    return this.findById(id);
  },

  async delete(id: string): Promise<void> {
    await ensureMigrated();
    await db
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId())));
  },

  async duplicate(id: string): Promise<Agent | null> {
    await ensureMigrated();
    const existing = await this.findById(id);
    if (!existing) return null;
    return this.create({
      name: `${existing.name} (copy)`,
      description: existing.description,
      status: "draft",
      config: existing.config,
      customTool: existing.customTool,
      externalApis: existing.externalApis,
    });
  },

  async incrementRunsCount(id: string): Promise<void> {
    await ensureMigrated();
    const existing = await this.findById(id);
    if (!existing) return;
    await db
      .update(agents)
      .set({
        runsCount: existing.runsCount + 1,
      })
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId())));
  },

  async getVersions(agentId: string) {
    await ensureMigrated();
    if (!(await this.findById(agentId))) return [];
    return db
      .select()
      .from(agentVersions)
      .where(eq(agentVersions.agentId, agentId))
      .orderBy(desc(agentVersions.version));
  },

  async getResources(agentId: string) {
    await ensureMigrated();
    if (!(await this.findById(agentId))) return [];
    return db.select().from(resources).where(eq(resources.agentId, agentId));
  },

  async addResource(
    agentId: string,
    data: { name: string; mimeType: string; size: number; content: string },
  ) {
    await ensureMigrated();
    if (!(await this.findById(agentId))) throw new Error("Agent not found");
    const id = uuidv4();
    await db.insert(resources).values({
      id,
      agentId,
      ...data,
      createdAt: Date.now(),
    });
    return id;
  },

  async deleteResource(id: string) {
    await ensureMigrated();
    const [resource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, id))
      .limit(1);
    if (!resource || !(await this.findById(resource.agentId))) return;
    await db.delete(resources).where(eq(resources.id, id));
  },

  async setApiKey(id: string, hash: string): Promise<void> {
    await ensureMigrated();
    await db
      .update(agents)
      .set({ apiKeyHash: hash || null })
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId())));
  },

  async revokeApiKey(id: string): Promise<void> {
    await ensureMigrated();
    await db
      .update(agents)
      .set({ apiKeyHash: null })
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId())));
  },
};
