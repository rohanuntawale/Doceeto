"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  Briefcase,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguageSelector } from "@/components/ui/language-selector";
import { AppDock, type DockItem } from "@/components/layout/app-dock";
import { cn } from "@/lib/utils/cn";
import { isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { NURSE_ACCENT_VARS } from "@/lib/nurse";

/**
 * Nurse shell — the same chrome as the doctor cockpit (mobile iOS tab pill,
 * desktop macOS dock), with a nurse's vocabulary. Gigs are the nurse's
 * primary storefront (appointments are the fallback), mirroring the doctor
 * cockpit exactly.
 *
 * Unlike the doctor console this one is TRANSLATED. Nurses in Nagpur read
 * Marathi and Hindi far more often than English, so every label here goes
 * through useT rather than being hardcoded.
 */
const NAV = [
  { id: "home", href: "/nurse", key: "nurse.nav.home", icon: LayoutDashboard, color: "#0A84FF", exact: true },
  { id: "requests", href: "/nurse/requests", key: "nurse.nav.requests", icon: ClipboardCheck, color: "#FFD60A" },
  { id: "gigs", href: "/nurse/gigs", key: "nurse.nav.gigs", icon: Briefcase, color: "#64D2FF" },
  { id: "active", href: "/nurse/active", key: "nurse.nav.active", icon: Activity, color: "#30D158" },
  { id: "earnings", href: "/nurse/earnings", key: "nurse.nav.earnings", icon: Banknote, color: "#BF5AF2" },
  { id: "profile", href: "/nurse/profile", key: "nurse.nav.profile", icon: UserRound, color: "#8E8E93" },
];

function activeIndex(pathname: string) {
  const found = [...NAV]
    .filter((n) =>
      n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/"),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  return found?.id ?? "home";
}

export function NurseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const active = activeIndex(pathname);

  async function logout() {
    if (!isDemoMode) {
      try {
        // Surface-tagged: ends the nurse session only, not a patient session
        // signed in on the same browser. Without this call the cookie stays
        // valid and "signing out" only changes the page.
        await apiFetch("/api/auth/logout", { method: "POST" });
      } catch {
        /* ignore */
      }
    }
    router.push(isDemoMode ? "/" : "/login");
    router.refresh();
  }

  const dockItems: DockItem[] = NAV.map((n) => ({
    id: n.id,
    href: n.href,
    label: t(n.key),
    icon: n.icon,
    color: n.color,
  }));

  const pillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pillRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    // The whole nurse console runs the blue accent — including the shared gig
    // cockpit page, which recolours through these vars with no fork.
    <div className="min-h-screen" style={NURSE_ACCENT_VARS}>
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-espresso/85 px-4 backdrop-blur-xl sm:px-6">
        <Link href="/nurse" aria-label={t("nurse.homeAria")}>
          <Wordmark compact />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-[var(--border)] bg-surface/70 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] sm:inline">
            {t("nurse.console")}
          </span>
          <button
            onClick={logout}
            aria-label={isDemoMode ? t("nurse.exitDemo") : t("nurse.signOut")}
            className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-surface/70 text-[var(--text-muted)] backdrop-blur transition-colors hover:text-[var(--text)]"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <LanguageSelector />
        </div>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(var(--chrome-dock)+1.75rem)] pt-4 sm:px-6 lg:pt-6">
        {children}
      </main>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-24 lg:h-32"
        style={{ background: "linear-gradient(to top, var(--bg) 25%, transparent)" }}
      />

      <nav className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3 lg:hidden">
        <div
          ref={pillRef}
          className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--glass-bg-strong)] p-1.5 shadow-[var(--elev-shadow-strong)] backdrop-blur-2xl [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map(({ id, href, key, icon: Icon }) => {
            const isOn = id === active;
            return (
              <Link
                key={href}
                href={href}
                aria-label={t(key)}
                data-active={isOn || undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full transition-all",
                  isOn
                    ? "bg-[rgb(var(--c-espresso-700))] px-3.5 py-2.5 text-primary"
                    : "px-2.5 py-2.5 text-[var(--text-muted)] active:text-[var(--text)]",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isOn ? 2.3 : 2} />
                {isOn && <span className="text-[13px] font-semibold">{t(key)}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <AppDock items={dockItems} activeId={active} />
    </div>
  );
}
