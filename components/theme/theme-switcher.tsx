"use client";

import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { THEMES, THEME_KEY, DEFAULT_THEME, type ThemeId } from "@/lib/theme";

/** A small palette popover that swaps the app's color theme. The choice
 *  is saved so it sticks across tabs and refreshes. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as ThemeId) || null;
    let saved: ThemeId | null = null;
    try {
      saved = (window.localStorage.getItem(THEME_KEY) as ThemeId) || null;
    } catch {
      /* ignore */
    }
    setTheme(current || saved || DEFAULT_THEME);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(id: ThemeId) {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_KEY, id);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change color theme"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 text-[var(--text-muted)] transition-colors hover:bg-espresso-800 hover:text-cream"
      >
        <Palette className="h-4 w-4" />
        <span
          className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-black/20"
          style={{ background: active.accent }}
        />
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="glass-strong absolute right-0 z-50 mt-2 w-56 animate-fade-up overflow-hidden rounded-card p-1.5">
            <div className="label px-2.5 py-1.5">Color theme</div>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg font-jp text-sm text-cream ring-1 ring-inset ring-black/20"
                  style={{ background: t.bg }}
                >
                  <span style={{ color: t.accent }}>{t.jp}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-cream">{t.name}</span>
                  <span className="block text-xs text-[var(--text-faint)]">{t.hint}</span>
                </span>
                {t.id === active.id && <Check className="h-4 w-4 text-salmon" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
