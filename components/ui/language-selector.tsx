"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Check } from "lucide-react";
import { useT, type LangCode } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

/**
 * Constant top-right language switcher. Glassy pill + popover.
 *
 * The popover is PORTALLED to <body> and positioned from the trigger's
 * measured rect. Rendered inline it was trapped in the sticky top bar's
 * stacking context (z-20), so its own z-50 meant nothing against the page:
 * it dropped onto the dashboard's stat row and profile avatar, covering
 * live tap targets with no backdrop. On <body> the z-index finally counts.
 */
export function LanguageSelector() {
  const { lang, setLang, languages } = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Measure before paint so the menu never flashes at the wrong spot, and
  // keep it pinned to the trigger while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = root.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on any press outside. A full-screen shield element can't do this
  // job here: inside the sticky top bar's stacking context it sits below the
  // floating nav pill, which then swallowed the dismiss tap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The menu now lives on <body>, so "outside" must exclude it too.
      if (
        !root.current?.contains(target) &&
        !(target instanceof Element && target.closest("[data-language-menu]"))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const active = languages.find((l) => l.code === lang) ?? languages[0];

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-surface/70 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] backdrop-blur transition-colors hover:text-[var(--text)]"
      >
        <Globe className="h-4 w-4" />
        <span>{active.native}</span>
      </button>

      {open &&
        mounted &&
        pos &&
        createPortal(
          <div
            data-language-menu
            style={{ top: pos.top, right: pos.right }}
            className="fh-card fixed z-[95] w-44 animate-fade-up overflow-hidden rounded-2xl p-1.5 shadow-[var(--elev-shadow-strong)]"
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
