import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { guardedFetch, resolvePublicHost } from "@/lib/security/ssrfGuard";
import { workflowStore } from "./store";
export async function pollTriggers(signal?: AbortSignal) {
  for (const workflow of (await workflowStore.list()).filter(
    (w) => w.activeRevision,
  )) {
    if (signal?.aborted) break;
    const graph = (await workflowStore.activeGraph(workflow.id))!;
    const trigger = graph.nodes.find((n) =>
      ["emailTrigger", "xTrigger"].includes(n.kind),
    );
    if (!trigger) continue;
    const state = await workflowStore.triggerState(workflow.id);
    try {
      if (trigger.kind === "emailTrigger") {
        const secret = await workflowStore.credential(
          String(trigger.config.credentialId),
          "email",
        );
        const address = await resolvePublicHost(secret.imapHost);
        const client = new ImapFlow({
          host: address,
          servername: secret.imapHost,
          port: Number(secret.imapPort ?? 993),
          secure: true,
          auth: { user: secret.user, pass: secret.password },
          logger: false,
          connectionTimeout: 10000,
          socketTimeout: 15000,
        });
        const abort = () => client.close();
        signal?.addEventListener("abort", abort, { once: true });
        try {
          signal?.throwIfAborted();
          await client.connect();
          const mailbox = await client.mailboxOpen(
            String(trigger.config.mailbox ?? "INBOX"),
          );
          const validity = String(mailbox.uidValidity);
          if (state.uidValidity !== validity || state.uid === undefined) {
            await workflowStore.setTriggerState(workflow.id, {
              uidValidity: validity,
              uid: mailbox.uidNext - 1,
            });
            continue;
          }
          let lastUid = Number(state.uid);
          if (lastUid < mailbox.uidNext - 1) {
            for await (const message of client.fetch(
              `${lastUid + 1}:*`,
              { uid: true, source: { maxLength: 1024 * 1024 + 1 } },
              { uid: true },
            )) {
              if (signal?.aborted) break;
              if (message.uid <= lastUid) continue;
              if (!message.source || message.source.length > 1024 * 1024) {
                lastUid = message.uid;
                continue;
              }
              const mail = await simpleParser(message.source, {
                skipHtmlToText: true,
                skipTextToHtml: true,
              });
              await workflowStore.enqueue(
                workflow,
                {
                  subject: mail.subject ?? "",
                  text: mail.text ?? "",
                  from: mail.from?.text ?? "",
                  messageId: mail.messageId ?? "",
                  uid: message.uid,
                },
                "email",
                {
                  graph,
                  revision: workflow.activeRevision!,
                  eventKey: `email:${validity}:${message.uid}`,
                },
              );
              lastUid = message.uid;
              await workflowStore.setTriggerState(workflow.id, {
                uidValidity: validity,
                uid: lastUid,
              });
            }
          }
          await workflowStore.setTriggerState(workflow.id, {
            uidValidity: validity,
            uid: lastUid,
          });
        } finally {
          signal?.removeEventListener("abort", abort);
          client.close();
        }
      } else {
        const secret = await workflowStore.credential(
          String(trigger.config.credentialId),
          "x",
        );
        if (!/^\d+$/.test(secret.userId ?? ""))
          throw new Error("X credentials require a numeric userId");
        const url = new URL(
          `https://api.x.com/2/users/${secret.userId}/mentions`,
        );
        url.searchParams.set("max_results", "100");
        if (state.sinceId)
          url.searchParams.set("since_id", String(state.sinceId));
        if (state.paginationToken)
          url.searchParams.set(
            "pagination_token",
            String(state.paginationToken),
          );
        const response = await guardedFetch(url.toString(), {
          headers: { authorization: `Bearer ${secret.accessToken}` },
          signal,
        });
        if (!response.ok)
          throw new Error(`X polling returned HTTP ${response.status}`);
        const data = (await response.json()) as {
          data?: Array<{
            id: string;
            text: string;
          }>;
          meta?: {
            newest_id?: string;
            next_token?: string;
          };
        };
        // Establish a baseline on first activation, rather than sending historical mentions.
        if (state.initialized)
          for (const post of [...(data.data ?? [])].reverse())
            await workflowStore.enqueue(
              workflow,
              { text: post.text, id: post.id },
              "x",
              {
                graph,
                revision: workflow.activeRevision!,
                eventKey: `x:${post.id}`,
              },
            );
        const newestId =
          state.pendingNewestId ?? data.meta?.newest_id ?? state.sinceId;
        // Drain backlogs over successive polls without advancing beyond unseen pages.
        if (state.initialized && data.meta?.next_token)
          await workflowStore.setTriggerState(workflow.id, {
            initialized: true,
            sinceId: state.sinceId,
            paginationToken: data.meta.next_token,
            pendingNewestId: newestId,
          });
        else
          await workflowStore.setTriggerState(workflow.id, {
            initialized: true,
            sinceId: newestId,
          });
      }
    } catch (error) {
      await workflowStore.setTriggerState(workflow.id, {
        ...state,
        lastError: error instanceof Error ? error.message : String(error),
        lastErrorAt: Date.now(),
      });
      console.error(
        JSON.stringify({
          event: "trigger.error",
          workflowId: workflow.id,
          integration: trigger.kind,
        }),
      );
    }
  }
}
