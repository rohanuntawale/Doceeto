"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Stethoscope,
  Pill,
  RotateCcw,
  ArrowLeftRight,
  Settings2,
  Check,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils/cn";
import { isDemoMode } from "@/lib/config";
import { resetTestData } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import { THEMES, THEME_KEY, DEFAULT_THEME, type ThemeId } from "@/lib/theme";

const nav = [
  { href: "/patient", label: "Home", icon: <Home className="h-4 w-4" /> },
  { href: "/patient/doctors", label: "Doctors", icon: <Stethoscope className="h-4 w-4" /> },
  { href: "/patient/medicine", label: "Medicine", icon: <Pill className="h-4 w-4" /> },
];

export function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      {/* App bar — one continuous full-width bar; content stays centered. */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-espresso/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <Link href="/patient" aria-label="Doceeto — patient home">
            <Wordmark compact />
          </Link>
          <AppMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 pb-24">
        {children}
      </main>

      {/* Bottom tab bar (consumer app feel) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-espresso/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch">
          {nav.map((item) => {
            const active =
              item.href === "/patient"
                ? pathname === "/patient"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                  active ? "text-terracotta" : "text-[var(--text-faint)]",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Single overflow menu: theme, doctor view, and (demo) reset — instead
 *  of a row of loose utility buttons. */
function AppMenu() {
  const toast = useToast();
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

  function pickTheme(id: ThemeId) {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function reset() {
    resetTestData();
    setOpen(false);
    toast.push({ tone: "info", title: "Test data cleared" });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-expanded={open}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg text-[var(--text-muted)] transition-colors",
          open
            ? "bg-white/8 text-[var(--text)]"
            : "hover:bg-white/5 hover:text-[var(--text)]",
        )}
      >
        <Settings2 className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-60 animate-fade-up overflow-hidden rounded-[14px] border border-[var(--border)] bg-espresso-800 p-1.5 shadow-card">
            {/* Theme picker — one tidy row of swatches */}
            <div className="label px-2.5 pb-1.5 pt-2">Appearance</div>
            <div className="flex items-center gap-1.5 px-2.5 pb-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTheme(t.id)}
                  title={`${t.name} · ${t.hint}`}
                  aria-label={`Theme ${t.name}`}
                  className={cn(
                    "relative grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset transition-transform hover:scale-105",
                    t.id === theme ? "ring-[var(--text)]/60" : "ring-white/15",
                  )}
                  style={{ background: t.bg }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: t.accent }}
                  />
                  {t.id === theme && (
                    <Check className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[var(--text)] p-0.5 text-[rgb(var(--c-espresso))]" />
                  )}
                </button>
              ))}
            </div>

            <div className="mx-1.5 my-1 h-px bg-[var(--border)]" />

            <MenuItem
              icon={<ArrowLeftRight className="h-4 w-4" />}
              label="Open doctor view"
              onClick={() => {
                setOpen(false);
                window.location.href = isDemoMode
                ? "/doctor"
                : "/api/dev/switch-role?role=doctor";
              }}
            />
            {isDemoMode && (
              <MenuItem
                icon={<RotateCcw className="h-4 w-4" />}
                label="Clear test data"
                onClick={reset}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
    >
      {icon}
      {label}
    </button>
  );
}
