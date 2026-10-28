import { randomUUID, randomBytes } from "node:crypto";
import {
  sqlite,
  query,
  execute,
  runMigrations,
  type Row,
} from "@/lib/db/client";
import { ownerId } from "@/lib/security/owner";
import {
  encryptSecret,
  decryptSecret,
  hashApiKey,
} from "@/lib/security/secrets";
import type {
  Workflow,
  WorkflowInput,
  WorkflowGraph,
  WorkflowRun,
  CredentialInput,
  CredentialSummary,
  NodeRun,
  RunStatus,
} from "./schema";
export const migrateWorkflows = runMigrations;
function workflow(row: Row): Workflow {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    graph: JSON.parse(String(row.graph)),
    revision: Number(row.revision),
    activeRevision:
      row.active_revision === null ? null : Number(row.active_revision),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}
function run(row: Row): WorkflowRun {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    revision: Number(row.revision),
    graph: JSON.parse(String(row.graph)),
    status: row.status as RunStatus,
    source: String(row.source),
    input: JSON.parse(String(row.input)),
    steps: JSON.parse(String(row.steps)),
    output: row.output === null ? null : JSON.parse(String(row.output)),
    error: row.error as string | null,
    retryOf: row.retry_of as string | null,
    cancelRequested: !!row.cancel_requested,
    createdAt: Number(row.created_at),
    startedAt: row.started_at as number | null,
    finishedAt: row.finished_at as number | null,
    leaseUntil: row.lease_until as number | null,
  };
}

export class StoreError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
async function mustOwn(id: string) {
  const w = await workflowStore.get(id);
  if (!w) throw new StoreError("Workflow not found", 404);
  return w;
}
export const workflowStore = {
  async list(): Promise<Workflow[]> {
    await runMigrations();
    return (
      await query(
        "SELECT * FROM workflows WHERE owner_id=? ORDER BY updated_at DESC",
        ownerId(),
      )
    ).map(workflow);
  },
  async get(id: string): Promise<Workflow | null> {
    await runMigrations();
    const [r] = await query(
      "SELECT * FROM workflows WHERE id=? AND owner_id=?",
      id,
      ownerId(),
    );
    return r ? workflow(r) : null;
  },
  async save(data: WorkflowInput, id?: string): Promise<Workflow> {
    await runMigrations();
    const owner = ownerId();
    const tx = await sqlite.transaction("write");
    const workflowId = id ?? randomUUID(),
      now = Date.now(),
      graph = JSON.stringify(data.graph);
    try {
      const existing = id
        ? (
            await tx.execute({
              sql: "SELECT revision FROM workflows WHERE id=? AND owner_id=?",
              args: [id, owner],
            })
          ).rows[0]
        : null;
      if (id && !existing) throw new StoreError("Workflow not found", 404);
      if (existing && data.revision !== Number(existing.revision))
        throw new StoreError(
          "This workflow was changed elsewhere. Reload before saving.",
          409,
        );
      const revision = Number(existing?.revision ?? 0) + 1;
      if (existing)
        await tx.execute({
          sql: "UPDATE workflows SET name=?,description=?,graph=?,revision=?,updated_at=? WHERE id=? AND owner_id=?",
          args: [
            data.name,
            data.description,
            graph,
            revision,
            now,
            workflowId,
            owner,
          ],
        });
      else
        await tx.execute({
          sql: "INSERT INTO workflows(id,name,description,graph,revision,created_at,updated_at,owner_id) VALUES(?,?,?,?,?,?,?,?)",
          args: [
            workflowId,
            data.name,
            data.description,
            graph,
            revision,
            now,
            now,
            owner,
          ],
        });
      await tx.execute({
        sql: "INSERT INTO workflow_versions(id,workflow_id,revision,graph,created_at) VALUES(?,?,?,?,?)",
        args: [randomUUID(), workflowId, revision, graph, now],
      });
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.close();
    }
    return (await this.get(workflowId))!;
  },
  async delete(id: string) {
    await mustOwn(id);
    if (
      (
        await query(
          "SELECT id FROM workflow_runs WHERE workflow_id=? AND status IN ('queued','running')",
          id,
        )
      ).length
    )
      throw new StoreError(
        "Cancel unfinished runs before deleting this workflow.",
        409,
      );
    await execute(
      "DELETE FROM workflows WHERE id=? AND owner_id=?",
      id,
      ownerId(),
    );
  },
  async versions(id: string) {
    await mustOwn(id);
    return (
      await query(
        "SELECT revision,graph,created_at FROM workflow_versions WHERE workflow_id=? ORDER BY revision DESC",
        id,
      )
    ).map((r) => ({
      revision: Number(r.revision),
      graph: JSON.parse(String(r.graph)),
      createdAt: Number(r.created_at),
    }));
  },
  async activeGraph(id: string): Promise<WorkflowGraph | null> {
    const w = await this.get(id);
    if (!w?.activeRevision) return null;
    const [r] = await query(
      "SELECT graph FROM workflow_versions WHERE workflow_id=? AND revision=?",
      id,
      w.activeRevision,
    );
    return r ? JSON.parse(String(r.graph)) : null;
  },
  async activate(id: string, active: boolean) {
    const w = await mustOwn(id);
    await execute(
      "UPDATE workflows SET active_revision=?,updated_at=? WHERE id=? AND owner_id=?",
      active ? w.revision : null,
      Date.now(),
      id,
      ownerId(),
    );
  },
  async rotateWebhookKey(id: string) {
    await mustOwn(id);
    const key = "wf_" + randomBytes(24).toString("hex");
    await execute(
      "UPDATE workflows SET webhook_hash=? WHERE id=? AND owner_id=?",
      hashApiKey(key),
      id,
      ownerId(),
    );
    return key;
  },
  async checkWebhookKey(id: string, key: string) {
    await runMigrations();
    const [r] = await query(
      "SELECT webhook_hash FROM workflows WHERE id=? AND owner_id=?",
      id,
      ownerId(),
    );
    return !!r?.webhook_hash && r.webhook_hash === hashApiKey(key);
  },
  async enqueue(
    w: Workflow,
    input: Record<string, unknown>,
    source = "manual",
    opts: {
      graph?: WorkflowGraph;
      revision?: number;
      eventKey?: string;
      retryOf?: string;
    } = {},
  ): Promise<WorkflowRun> {
    await mustOwn(w.id);
    const id = randomUUID(),
      graph = opts.graph ?? w.graph;
    const steps: NodeRun[] = graph.nodes.map((n) => ({
      nodeId: n.id,
      label: n.label,
      kind: n.kind,
      status: "pending",
      attempt: 0,
    }));
    await execute(
      "INSERT INTO workflow_runs(id,workflow_id,revision,graph,status,source,input,steps,created_at,retry_of,event_key) VALUES(?,?,?,?,'queued',?,?,?,?,?,?) ON CONFLICT(workflow_id,event_key) DO NOTHING",
      id,
      w.id,
      opts.revision ?? w.revision,
      JSON.stringify(graph),
      source,
      JSON.stringify(input),
      JSON.stringify(steps),
      Date.now(),
      opts.retryOf ?? null,
      opts.eventKey ?? null,
    );
    if (opts.eventKey) {
      const [r] = await query(
        "SELECT * FROM workflow_runs WHERE workflow_id=? AND event_key=?",
        w.id,
        opts.eventKey,
      );
      return run(r);
    }
    return (await this.getRun(id))!;
  },
  async runs(id: string, limit = 50): Promise<WorkflowRun[]> {
    await mustOwn(id);
    return (
      await query(
        "SELECT * FROM workflow_runs WHERE workflow_id=? ORDER BY created_at DESC LIMIT ?",
        id,
        Math.min(Math.max(limit, 1), 100),
      )
    ).map(run);
  },
  async getRun(id: string): Promise<WorkflowRun | null> {
    await runMigrations();
    const [r] = await query(
      "SELECT r.* FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE r.id=? AND w.owner_id=?",
      id,
      ownerId(),
    );
    return r ? run(r) : null;
  },
  // Worker-only queue operations. Claims atomically carry the owner into execution.
  async claim(
    workerId: string,
    target?: { id: string; ownerId: string },
  ): Promise<(WorkflowRun & { ownerId: string }) | null> {
    await runMigrations();
    const now = Date.now();
    await execute(
      "UPDATE workflow_runs SET status='interrupted',error='Worker stopped unexpectedly. Review completed actions before retrying.',finished_at=? WHERE status='running' AND lease_until<?",
      now,
      now,
    );
    const rows = await query(
      "UPDATE workflow_runs SET status='running',started_at=?,lease_until=?,worker_id=? WHERE id=(SELECT r.id FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id JOIN users u ON u.id=w.owner_id WHERE r.status='queued' AND u.password_hash IS NOT NULL" +
        (target ? " AND r.id=? AND w.owner_id=?" : "") +
        " ORDER BY r.created_at LIMIT 1) AND status='queued' RETURNING *",
      now,
      now + 60000,
      workerId,
      ...(target ? [target.id, target.ownerId] : []),
    );
    if (!rows[0]) return null;
    const [w] = await query(
      "SELECT owner_id FROM workflows WHERE id=?",
      rows[0].workflow_id,
    );
    return { ...run(rows[0]), ownerId: String(w.owner_id) };
  },
  async heartbeat(workerId: string, runId?: string) {
    await runMigrations();
    await execute(
      "INSERT INTO workflow_worker_health VALUES(?,?) ON CONFLICT(id) DO UPDATE SET heartbeat=excluded.heartbeat",
      workerId,
      Date.now(),
    );
    if (runId)
      await execute(
        "UPDATE workflow_runs SET lease_until=? WHERE id=? AND worker_id=? AND status='running'",
        Date.now() + 60000,
        runId,
        workerId,
      );
  },
  async workerOnline() {
    await runMigrations();
    return !!(
      await query(
        "SELECT id FROM workflow_worker_health WHERE id<>'scheduler:last-tick' AND heartbeat>? LIMIT 1",
        Date.now() - 60000,
      )
    ).length;
  },
  async progress(id: string, steps: NodeRun[]) {
    if (!(await this.getRun(id)))
      throw new StoreError("Execution not found", 404);
    await execute(
      "UPDATE workflow_runs SET steps=? WHERE id=? AND status='running'",
      JSON.stringify(steps),
      id,
    );
  },
  async finish(
    id: string,
    status: RunStatus,
    steps: NodeRun[],
    output: unknown,
    error?: string,
  ) {
    if (!(await this.getRun(id)))
      throw new StoreError("Execution not found", 404);
    await execute(
      "UPDATE workflow_runs SET status=?,steps=?,output=?,error=?,finished_at=?,lease_until=NULL WHERE id=? AND status='running'",
      status,
      JSON.stringify(steps),
      JSON.stringify(output ?? null),
      error ?? null,
      Date.now(),
      id,
    );
  },
  async cancel(id: string) {
    if (!(await this.getRun(id)))
      throw new StoreError("Execution not found", 404);
    await execute(
      "UPDATE workflow_runs SET cancel_requested=1,status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,finished_at=CASE WHEN status='queued' THEN ? ELSE finished_at END WHERE id=? AND status IN ('queued','running')",
      Date.now(),
      id,
    );
  },
  async credentials(): Promise<CredentialSummary[]> {
    await runMigrations();
    return (
      await query(
        "SELECT id,name,kind,created_at FROM workflow_credentials WHERE owner_id=? ORDER BY created_at DESC",
        ownerId(),
      )
    ).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      kind: r.kind as CredentialSummary["kind"],
      createdAt: Number(r.created_at),
    }));
  },
  async saveCredential(data: CredentialInput) {
    await runMigrations();
    const id = randomUUID();
    await execute(
      "INSERT INTO workflow_credentials(id,name,kind,encrypted,created_at,owner_id) VALUES(?,?,?,?,?,?)",
      id,
      data.name,
      data.kind,
      encryptSecret(JSON.stringify(data.values)),
      Date.now(),
      ownerId(),
    );
    return (await this.credentials()).find((c) => c.id === id)!;
  },
  async credential(
    id: string,
    kind?: CredentialSummary["kind"],
  ): Promise<Record<string, string>> {
    await runMigrations();
    const [r] = await query(
      "SELECT * FROM workflow_credentials WHERE id=? AND owner_id=?",
      id,
      ownerId(),
    );
    if (!r || (kind && r.kind !== kind))
      throw new StoreError(
        "Credential not found or wrong integration type.",
        404,
      );
    return JSON.parse(decryptSecret(String(r.encrypted)));
  },
  async deleteCredential(id: string) {
    await this.credential(id);
    for (const w of await this.list()) {
      const graphs = [w.graph, await this.activeGraph(w.id)].filter(
        Boolean,
      ) as WorkflowGraph[];
      if (graphs.some((g) => g.nodes.some((n) => n.config.credentialId === id)))
        throw new StoreError("Credential is referenced by a workflow.", 409);
    }
    await execute(
      "DELETE FROM workflow_credentials WHERE id=? AND owner_id=?",
      id,
      ownerId(),
    );
  },
  async triggerState(id: string): Promise<Record<string, unknown>> {
    await mustOwn(id);
    const [r] = await query(
      "SELECT state FROM workflow_trigger_state WHERE workflow_id=?",
      id,
    );
    return r ? JSON.parse(String(r.state)) : {};
  },
  async setTriggerState(id: string, state: Record<string, unknown>) {
    await mustOwn(id);
    await execute(
      "INSERT INTO workflow_trigger_state VALUES(?,?) ON CONFLICT(workflow_id) DO UPDATE SET state=excluded.state",
      id,
      JSON.stringify(state),
    );
  },
};
