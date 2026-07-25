"use client";

import { useEffect, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useT, type LangCode } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

/** Constant top-right language switcher. Glassy pill + popover. */
export function LanguageSelector() {
  const { lang, setLang, languages } = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = languages.find((l) => l.code === lang) ?? languages[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-surface/70 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] backdrop-blur transition-colors hover:text-[var(--text)]"
      >
        <Globe className="h-4 w-4" />
        <span>{active.native}</span>
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="fh-card absolute right-0 z-50 mt-2 w-44 animate-fade-up overflow-hidden rounded-2xl p-1.5">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code as LangCode);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  l.code === lang
                    ? "bg-primary/10 text-primary"
                    : "text-[var(--text-muted)] hover:bg-[var(--c-espresso-700)] hover:text-[var(--text)]",
                )}
              >
                <span>
                  {l.native}
                  <span className="ml-1.5 text-xs text-[var(--text-faint)]">
                    {l.label !== l.native ? l.label : ""}
                  </span>
                </span>
                {l.code === lang && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
