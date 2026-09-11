"use client";

import { useState } from "react";
import { Check, Clock3, Copy, KeyRound, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

type ProviderRole = "doctor" | "nurse";

interface InviteResult {
  code: string;
  role: ProviderRole;
  expiresAt: string;
}

export function ProviderInviteGenerator() {
  const [role, setRole] = useState<ProviderRole>("doctor");
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const response = await apiFetch("/api/ops/provider-invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not generate an invite.");
      setInvite(body as InviteResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate an invite.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
  }

  const expiry = invite
    ? new Date(invite.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-terracotta/15 text-salmon">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <p className="label">PROVIDER ACCESS</p>
          <h2 className="mt-1 font-serif text-xl text-cream">Issue a one-time invite</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
            One active code per role. A new code immediately revokes the previous unused one.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["doctor", "nurse"] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setRole(candidate)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              role === candidate
                ? "border-terracotta bg-terracotta text-on-accent"
                : "border-[var(--border)] text-[var(--text-muted)] hover:text-cream"
            }`}
          >
            {candidate === "doctor" ? "Doctor" : "Nurse"}
          </button>
        ))}
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-terracotta px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Generating…" : "Generate 30 min code"}
        </button>
      </div>

      {invite && (
        <div className="mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <code className="select-all text-base font-semibold tracking-[0.12em] text-cream">{invite.code}</code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-cream hover:bg-white/[0.06]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-status-ok" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Clock3 className="h-3.5 w-3.5 text-salmon" />
            Share with one {invite.role}. Expires at {expiry}; first successful signup consumes it.
          </p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-status-critical">{error}</p>}
    </section>
  );
}
