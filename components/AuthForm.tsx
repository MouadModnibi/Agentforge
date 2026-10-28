"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecretInput } from "@/components/ui/secret-input";
import { WorkspaceArtwork } from "@/components/WorkspaceArtwork";

export function AuthForm({ register = false }: { register?: boolean }) {
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  return (
    <div className="m4m-auth-layout">
      <aside className="m4m-auth-story">
        <p className="m4m-account-eyebrow">M4M / AUTOMATION STUDIO</p>
        <h2>
          A clear path
          <br />
          from event
          <br />
          to action.
        </h2>
        <p>
          Connect your services, give agents their instructions, and build
          workflows you can follow.
        </p>
        <WorkspaceArtwork className="m4m-auth-artwork" />
        <span className="m4m-auth-caption">
          ILLUSTRATIVE WORKFLOW · BUILT YOUR WAY
        </span>
      </aside>
      <section className="m4m-account-card">
        <LockKeyhole className="m4m-auth-lock" size={22} />
        <p className="m4m-account-eyebrow">YOUR PRIVATE WORKSPACE</p>
        <h1>{register ? "Create an account" : "Welcome back"}</h1>
        <p className="m4m-account-description">
          {register
            ? "Your workflows, agents, and connections. Together in one place."
            : "Sign in to continue where you left off."}
        </p>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            const form = e.currentTarget,
              values = new FormData(form);
            const next: Record<string, string> = {};
            if (register && !String(values.get("name") ?? "").trim())
              next.name = "Enter your name.";
            if (
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                String(values.get("email") ?? ""),
              )
            )
              next.email = "Enter a valid email address.";
            const password = String(values.get("password") ?? "");
            if (password.length < (register ? 10 : 1))
              next.password = register
                ? "Use at least 10 characters."
                : "Enter your password.";
            setFields(next);
            setError("");
            if (Object.keys(next).length) {
              (
                form.elements.namedItem(Object.keys(next)[0]) as HTMLElement
              )?.focus();
              return;
            }
            setPending(true);
            try {
              const r = await fetch(
                register ? "/api/auth/register" : "/api/auth",
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    name: register ? values.get("name") : undefined,
                    email: values.get("email"),
                    password,
                  }),
                },
              );
              const j = await r.json();
              if (!r.ok)
                throw new Error(
                  j.error?.message || "Unable to sign in. Try again.",
                );
              try {
                localStorage.setItem("m4m-auth-event", String(Date.now()));
              } catch {}
              window.location.assign("/workflows");
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Unable to sign in. Try again.",
              );
              setPending(false);
            }
          }}
        >
          {register && (
            <div className="m4m-form-field">
              <label htmlFor="auth-name">Your name</label>
              <Input
                id="auth-name"
                name="name"
                autoComplete="name"
                maxLength={80}
                required
                placeholder="Your name"
                aria-invalid={!!fields.name}
                aria-describedby={fields.name ? "auth-name-error" : undefined}
              />
              {fields.name && (
                <p id="auth-name-error" className="m4m-field-error">
                  {fields.name}
                </p>
              )}
            </div>
          )}
          <div className="m4m-form-field">
            <label htmlFor="auth-email">Email address</label>
            <Input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              placeholder="you@example.com"
              aria-invalid={!!fields.email}
              aria-describedby={fields.email ? "auth-email-error" : undefined}
            />
            {fields.email && (
              <p id="auth-email-error" className="m4m-field-error">
                {fields.email}
              </p>
            )}
          </div>
          <div className="m4m-form-field">
            <label htmlFor="auth-password">Password</label>
            <SecretInput
              id="auth-password"
              name="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 10 : 1}
              maxLength={128}
              required
              placeholder={
                register ? "At least 10 characters" : "Your password"
              }
              aria-invalid={!!fields.password}
              aria-describedby={
                fields.password ? "auth-password-error" : undefined
              }
            />
            {fields.password && (
              <p id="auth-password-error" className="m4m-field-error">
                {fields.password}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="m4m-field-error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Please wait…" : register ? "Create account" : "Sign in"}
            <ArrowRight size={16} />
          </Button>
        </form>
        <p className="m4m-account-switch">
          {register ? "Already have an account?" : "New to m4m?"}{" "}
          <Link href={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </div>
  );
}
