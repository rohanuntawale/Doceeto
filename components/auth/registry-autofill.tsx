"use client";

/**
 * Fills a provider's details from their council registration number.
 *
 * Deliberately a button, not an on-blur lookup: the register is someone else's
 * undocumented endpoint, and firing it on every keystroke or tab-out would both
 * hammer it and surprise people whose details are about to be overwritten.
 *
 * A hit here is a convenience, never a credential. Ops still confirms against
 * the official register before anyone is marked verified — see lib/registry.
 */

import { useState } from "react";
import { Check, Loader2, Search } from "lucide-react";

type Match = {
  registrationNo: string;
  fullName: string;
  council?: string;
  year?: string;
  qualification?: string;
  source: string;
};

export function RegistryAutofill({
  registrationNo,
  onApply,
}: {
  registrationNo: string;
  /** Called with whichever match the person picks. */
  onApply: (match: Match) => void;
}) {
  const [state, setState] = useState<
    "idle" | "loading" | "none" | "unavailable" | "error"
  >("idle");
  const [matches, setMatches] = useState<Match[]>([]);
  const [applied, setApplied] = useState<string | null>(null);

  const run = async () => {
    const value = registrationNo.trim();
    if (!value) return;
    setState("loading");
    setMatches([]);
    setApplied(null);
    try {
      const res = await fetch(
        `/api/registry/lookup?registrationNo=${encodeURIComponent(value)}`,
      );
      const body = await res.json();
      if (!res.ok) return setState("error");
      if (body.unavailable) return setState("unavailable");
      if (!body.matches?.length) return setState("none");
      setMatches(body.matches);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={run}
        disabled={!registrationNo.trim() || state === "loading"}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Search className="h-3.5 w-3.5" />
        )}
        Fetch my details
      </button>

      {state === "none" && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          No match on the register for that number. Check it, or just fill the
          form in yourself — our team verifies either way.
        </p>
      )}
      {(state === "unavailable" || state === "error") && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          The medical register isn&apos;t responding right now. Fill the form in
          yourself — this only saves typing.
        </p>
      )}

      {matches.length > 0 && (
        <ul className="mt-2 space-y-2">
          {matches.map((m) => {
            const isApplied = applied === m.registrationNo + m.fullName;
            return (
              <li key={m.registrationNo + m.fullName}>
                <button
                  type="button"
                  onClick={() => {
                    onApply(m);
                    setApplied(m.registrationNo + m.fullName);
                  }}
                  className="w-full rounded-xl border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--accent)]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--text)]">
                      {m.fullName}
                    </span>
                    {isApplied ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-status-ok">
                        <Check className="h-3.5 w-3.5" /> Filled in
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-[var(--accent)]">
                        Use this
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                    {[m.qualification, m.council, m.year]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
          <li className="text-[11px] text-[var(--text-faint)]">
            From {matches[0].source}. Our team still checks this before your
            profile goes live.
          </li>
        </ul>
      )}
    </div>
  );
}
