"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ArrowLeftRight } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { cn } from "@/lib/utils/cn";
import { isDemoMode } from "@/lib/config";
import { clearOpsAuthed } from "@/lib/ops-auth";

export interface NavItem {
  href: string;
  label: string;
  kanji?: string;
  icon: React.ReactNode;
}

export function Shell({
  role,
  sectionLabel,
  nav,
  children,
}: {
  role: "doctor" | "ops";
  sectionLabel: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Ops is admin-only, so never surface a one-click hop into it: the doctor
  // cockpit switches to the patient app; ops switches back to the cockpit.
  // A session cookie is one role at a time, so in live mode the switch goes
  // through the dev-only role switcher (swaps the session); demo mode can
  // navigate straight across.
  const switchTo =
    role === "doctor"
      ? { href: isDemoMode ? "/patient" : "/api/dev/switch-role?role=patient", label: "Patient app" }
      : { href: isDemoMode ? "/doctor" : "/api/dev/switch-role?role=doctor", label: "Doctor space" };

  async function logout() {
    if (role === "ops") clearOpsAuthed();
    if (!isDemoMode) {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        /* ignore */
      }
    }
    if (role === "ops") router.push("/ops-signin");
    else router.push(isDemoMode ? "/" : "/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-[var(--border)] bg-espresso px-3 py-4 lg:flex">
        <div className="px-2 py-2">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
        <div className="label mt-4 px-3">{sectionLabel}</div>
        <nav className="mt-2 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-[var(--border)] pt-3">
          <a
            href={switchTo.href}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-espresso-800 hover:text-cream"
          >
            <ArrowLeftRight className="h-4 w-4" />
            {switchTo.label}
          </a>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-espresso-800 hover:text-cream"
          >
            <LogOut className="h-4 w-4" />
            {isDemoMode ? "Exit demo" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-espresso/85 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Link href="/">
              <Wordmark />
            </Link>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <span className="font-jp text-sm text-salmon">
              {role === "doctor" ? "助け" : "検診"}
            </span>
            <span className="label">
              {role === "doctor" ? "Doctor space" : "Team console"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 py-2 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm",
                isActive(pathname, item.href)
                  ? "bg-terracotta/15 text-salmon"
                  : "text-[var(--text-muted)]",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-terracotta/15 text-cream ring-1 ring-inset ring-terracotta/25"
          : "text-[var(--text-muted)] hover:bg-espresso-800 hover:text-cream",
      )}
    >
      <span className={cn("shrink-0", active ? "text-terracotta" : "")}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.kanji && (
        <span className="font-jp text-xs text-[var(--text-faint)]">
          {item.kanji}
        </span>
      )}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href.endsWith("/doctor") || href.endsWith("/ops")) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
