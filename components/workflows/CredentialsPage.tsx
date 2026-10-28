"use client";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  Send,
  Mail,
  Globe,
  MessageSquare,
} from "lucide-react";
import { useCredentials, workflowFetch } from "@/lib/hooks/useWorkflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecretInput } from "@/components/ui/secret-input";
import { useConfirmAction } from "@/components/ui/confirm-action";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { CredentialInput } from "@/lib/workflows/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
const credentialFields = {
  telegram: ["botToken", "webhookSecret"],
  email: [
    "imapHost",
    "imapPort",
    "smtpHost",
    "smtpPort",
    "user",
    "password",
    "from",
  ],
  x: ["accessToken", "userId"],
  http: [],
};
const labels: Record<string, string> = {
  botToken: "Bot token",
  webhookSecret: "Webhook secret",
  imapHost: "IMAP hostname",
  imapPort: "IMAP port (993)",
  smtpHost: "SMTP hostname",
  smtpPort: "SMTP port (465 / 587)",
  user: "Email username",
  password: "Password / app password",
  from: "Sender email (optional)",
  accessToken: "User access token",
  userId: "Your X user ID",
};
const kindIcons = {
  telegram: Send,
  email: Mail,
  x: MessageSquare,
  http: Globe,
};
const kindLabels = {
  telegram: "Telegram",
  email: "Email",
  x: "X / Twitter",
  http: "HTTP API",
};
const requiredFields: Record<CredentialInput["kind"], string[]> = {
  telegram: ["botToken", "webhookSecret"],
  email: ["imapHost", "smtpHost", "user", "password"],
  x: ["accessToken", "userId"],
  http: [],
};
export function CredentialsPage() {
  const confirmAction = useConfirmAction();
  const [formError, setFormError] = useState("");
  const [nameError, setNameError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showHeaders, setShowHeaders] = useState(false);
  const { data, error, isLoading, refetch } = useCredentials(),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [kind, setKind] = useState<CredentialInput["kind"]>("telegram"),
    [values, setValues] = useState<Record<string, string>>({}),
    [headers, setHeaders] = useState('{"Authorization": "Bearer your-token"}'),
    [busy, setBusy] = useState(false),
    qc = useQueryClient();
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="forge-dashboard">
      <div className="forge-page-heading">
        <div>
          <h1>Credentials</h1>
          <p>Saved connections for your workflows.</p>
        </div>
        <Button
          onClick={(e) => {
            returnFocus.current = e.currentTarget;
            setOpen(true);
          }}
        >
          <Plus />
          Add credential
        </Button>
      </div>
      <div className="m4m-credentials-layout">
        <section aria-label="Saved connections">
          {error ? (
            <div>
              <p className="text-destructive" role="alert">
                {error.message}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2" aria-label="Loading credentials">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : data?.length ? (
            <div className="m4m-credential-table">
              <table className="w-full text-[13px]">
                <thead className="border-b bg-muted/20 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Service</th>
                    <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">
                      Created
                    </th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((credential) => {
                    const Icon = kindIcons[credential.kind];
                    return (
                      <tr
                        key={credential.id}
                        className="border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-3 font-medium">
                          <span className="flex items-center gap-3">
                            <Icon
                              size={16}
                              className="shrink-0 text-muted-foreground"
                            />
                            {credential.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {kindLabels[credential.kind]}
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                          {new Date(credential.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            aria-label={`Delete credential ${credential.name}`}
                            onClick={async () => {
                              if (
                                !(await confirmAction({
                                  title: `Delete ${credential.name}?`,
                                  description:
                                    "This permanently removes the saved connection. Workflows using it will need another credential.",
                                  action: "Delete credential",
                                  destructive: true,
                                }))
                              )
                                return;
                              try {
                                await workflowFetch(
                                  `/api/workflow-credentials?id=${credential.id}`,
                                  "DELETE",
                                );
                                qc.invalidateQueries({
                                  queryKey: ["workflow-credentials"],
                                });
                                toast.success("Credential deleted");
                              } catch (e) {
                                toast.error(
                                  e instanceof Error
                                    ? e.message
                                    : "Delete failed",
                                );
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="forge-empty">
              <KeyRound size={24} className="mb-3 text-muted-foreground" />
              <h3>No credentials yet</h3>
              <p>Add a connection for Telegram, email, X, or an HTTP API.</p>
              <Button
                variant="outline"
                onClick={(e) => {
                  returnFocus.current = e.currentTarget;
                  setOpen(true);
                }}
              >
                <Plus size={15} />
                Add credential
              </Button>
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={13} className="shrink-0" />
            Encrypted on your server. Credential values are excluded from
            workflow exports.
          </p>
        </section>
        <aside className="m4m-credential-note">
          <ShieldCheck size={23} />
          <h2>Connect once. Reuse securely.</h2>
          <p>
            Give your workflows access to the services they need, without
            putting secrets on the canvas.
          </p>
          <ol>
            <li>Add a service connection.</li>
            <li>Select it in a workflow node.</li>
            <li>Keep secret values out of exports.</li>
          </ol>
        </aside>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="wf-modal"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a credential</DialogTitle>
            <DialogDescription>
              Save a connection to use in workflow nodes.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setFormError("");
              setNameError("");
              setFieldErrors({});
              if (!name.trim()) {
                setNameError("Enter a name for this connection.");
                (
                  e.currentTarget.elements.namedItem(
                    "credential-name",
                  ) as HTMLElement
                )?.focus();
                return;
              }
              const next: Record<string, string> = {};
              for (const key of requiredFields[kind])
                if (!values[key]?.trim())
                  next[key] = `Enter ${labels[key].toLowerCase()}.`;
              if (
                kind === "telegram" &&
                values.webhookSecret &&
                !/^[A-Za-z0-9_-]{1,256}$/.test(values.webhookSecret)
              )
                next.webhookSecret =
                  "Use 1–256 letters, numbers, underscores, or hyphens.";
              if (kind === "email") {
                for (const key of ["imapPort", "smtpPort"])
                  if (
                    values[key] &&
                    (!/^\d+$/.test(values[key]) ||
                      +values[key] < 1 ||
                      +values[key] > 65535)
                  )
                    next[key] = "Use a port between 1 and 65535.";
                if (
                  values.smtpPort &&
                  !["465", "587"].includes(values.smtpPort)
                )
                  next.smtpPort = "Use TLS port 465 or STARTTLS port 587.";
              }
              if (Object.keys(next).length) {
                setFieldErrors(next);
                (
                  e.currentTarget.elements.namedItem(
                    `connection-${Object.keys(next)[0]}`,
                  ) as HTMLElement
                )?.focus();
                return;
              }
              setBusy(true);
              try {
                const payload = {
                  name,
                  kind,
                  values: kind === "http" ? JSON.parse(headers) : values,
                };
                await workflowFetch(
                  "/api/workflow-credentials",
                  "POST",
                  payload,
                );
                qc.invalidateQueries({ queryKey: ["workflow-credentials"] });
                setOpen(false);
                setName("");
                setValues({});
                toast.success("Credential stored securely");
              } catch (e) {
                setFormError(
                  e instanceof Error
                    ? e.message
                    : "Could not save credential. Try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="wf-field">
              <label htmlFor="credential-name">Name</label>
              <Input
                id="credential-name"
                name="credential-name"
                autoComplete="off"
                maxLength={100}
                aria-invalid={!!nameError}
                aria-describedby={
                  nameError ? "credential-name-error" : undefined
                }
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Work email"
              />
              {nameError && (
                <small id="credential-name-error" className="m4m-field-error">
                  {nameError}
                </small>
              )}
            </div>
            <label className="wf-field">
              <span>Integration</span>
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as CredentialInput["kind"]);
                  setValues({});
                  setFieldErrors({});
                  setFormError("");
                }}
              >
                <option value="telegram">Telegram</option>
                <option value="email">Email (IMAP + SMTP)</option>
                <option value="x">X / Twitter</option>
                <option value="http">HTTP API headers</option>
              </select>
            </label>
            {credentialFields[kind].map((key) => {
              const FieldInput = /token|secret|password/i.test(key)
                ? SecretInput
                : Input;
              return (
                <div className="wf-field" key={key}>
                  <label htmlFor={`credential-${key}`}>{labels[key]}</label>
                  <FieldInput
                    id={`credential-${key}`}
                    name={`connection-${key}`}
                    required={requiredFields[kind].includes(key)}
                    aria-invalid={!!fieldErrors[key]}
                    aria-describedby={
                      fieldErrors[key] ? `credential-${key}-error` : undefined
                    }
                    autoComplete={
                      /token|secret|password/i.test(key)
                        ? "new-password"
                        : "off"
                    }
                    value={values[key] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [key]: e.target.value }))
                    }
                  />
                  {fieldErrors[key] && (
                    <small
                      id={`credential-${key}-error`}
                      className="m4m-field-error"
                    >
                      {fieldErrors[key]}
                    </small>
                  )}
                </div>
              );
            })}
            {kind === "http" && (
              <div className="wf-field">
                <label htmlFor="credential-headers">
                  Secret headers (JSON object)
                </label>
                {showHeaders ? (
                  <Textarea
                    id="credential-headers"
                    rows={5}
                    className="wf-json"
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                  />
                ) : (
                  <Input
                    id="credential-headers"
                    type="password"
                    aria-label="Secret headers (JSON object)"
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    autoComplete="off"
                  />
                )}
                <button
                  type="button"
                  className="text-primary text-xs text-left"
                  aria-pressed={showHeaders}
                  onClick={() => setShowHeaders(!showHeaders)}
                >
                  {showHeaders
                    ? "Hide secret headers"
                    : "Show and edit secret headers"}
                </button>
              </div>
            )}
            {kind === "email" && (
              <p className="wf-notice">
                TLS connections only. Gmail may require an app password. The
                trigger starts with new mail received after its first poll.
              </p>
            )}
            {kind === "x" && (
              <p className="wf-notice">
                Use an X user token with the required read/write scopes. X API
                usage requires your own access and paid credits.
              </p>
            )}
            {formError && (
              <p role="alert" className="m4m-field-error mb-4">
                {formError}
              </p>
            )}
            <Button disabled={busy} className="w-full">
              {busy ? "Saving…" : "Save credential"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
