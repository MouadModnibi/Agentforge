"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/lib/hooks/useAccount";
import { workflowFetch } from "@/lib/hooks/useWorkflows";
import { Button } from "@/components/ui/button";
import { SecretInput } from "@/components/ui/secret-input";
import { useConfirmAction } from "@/components/ui/confirm-action";
export default function Settings() {
  const confirmAction = useConfirmAction();
  const { data: user } = useAccount(),
    qc = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["account-key"],
    queryFn: () => workflowFetch<{ hasGeminiKey: boolean }>("/api/account"),
  });
  const [key, setKey] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(value: string) {
    setBusy(true);
    setMessage("");
    try {
      await workflowFetch("/api/account", "PATCH", { geminiKey: value });
      setKey("");
      await qc.invalidateQueries({ queryKey: ["account-key"] });
      setMessage(value ? "Gemini key saved." : "Gemini key removed.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="forge-dashboard">
      <div className="forge-page-heading">
        <div>
          <h1>Account settings</h1>
          <p>Manage your account and AI connection.</p>
        </div>
      </div>
      <div className="m4m-settings-layout">
        <aside className="m4m-settings-profile">
          <strong>{user?.name ?? "Your account"}</strong>
          <p>{user?.email}</p>
          <small>
            Your workflows, agents, and credentials are private to this account.
          </small>
        </aside>
        <section className="m4m-settings-card">
          <h2>Gemini connection</h2>
          <p>
            Use your own API key for AI steps. It is encrypted and belongs only
            to your account.
          </p>
          <p
            className={`m4m-key-status ${data?.hasGeminiKey && !error ? "is-connected" : ""}`}
            role="status"
          >
            {isLoading
              ? "Checking connection…"
              : error
                ? "Unable to load connection status"
                : data?.hasGeminiKey
                  ? "Connected · key saved"
                  : "No API key configured"}
          </p>
          {error && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry connection check
            </Button>
          )}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (busy || !key.trim()) return;
              void save(key);
            }}
          >
            <label htmlFor="gemini-key">
              {data?.hasGeminiKey ? "Replace API key" : "Gemini API key"}
            </label>
            <SecretInput
              id="gemini-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              maxLength={256}
              required
              placeholder="Paste your Gemini API key"
            />
            <div className="flex gap-3">
              <Button disabled={busy || !key.trim()}>Save key</Button>
              {data?.hasGeminiKey && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await confirmAction({
                        title: "Remove Gemini key?",
                        description:
                          "AI steps that use this account key will stop working until you add a new key.",
                        action: "Remove key",
                        destructive: true,
                      })
                    )
                      void save("");
                  }}
                >
                  Remove key
                </Button>
              )}
            </div>
          </form>
          <p role="status">{message}</p>
        </section>
      </div>
    </main>
  );
}
