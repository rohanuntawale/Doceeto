"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Inbox,
  CalendarDays,
  Stethoscope,
  Wallet,
  UserRound,
  LogOut,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguageSelector } from "@/components/ui/language-selector";
import { AppDock, type DockItem } from "@/components/layout/app-dock";
import { cn } from "@/lib/utils/cn";
import { isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";

/**
 * Doctor shell — mobile iOS tab pill, desktop macOS dock (no sidebar).
 * Sign-out lives in the top bar. A session is one role at a time, so there
 * is no patient↔doctor view switch: use the other role's account instead.
 */
/**
 * The two ways a doctor earns sit side by side: "Gigs" is the shelf of service
 * packages they publish, "Schedule" is their bookable calendar. "Requests" is
 * the inbox both feed into — it used to be labelled "Gigs", which is why the
 * ids and labels no longer line up with the older hrefs.
 */
const NAV = [
  { id: "home", href: "/doctor", label: "Home", icon: LayoutDashboard, color: "#0A84FF", exact: true },
  { id: "gigs", href: "/doctor/gigs", label: "Gigs", icon: Briefcase, color: "#FF9F0A" },
  { id: "requests", href: "/doctor/requests", label: "Requests", icon: Inbox, color: "#FFD60A" },
  { id: "schedule", href: "/doctor/schedule", label: "Schedule", icon: CalendarDays, color: "#FF375F" },
  { id: "consults", href: "/doctor/consults", label: "Consults", icon: Stethoscope, color: "#30D158" },
  { id: "wallet", href: "/doctor/earnings", label: "Wallet", icon: Wallet, color: "#BF5AF2" },
  { id: "profile", href: "/doctor/profile", label: "Profile", icon: UserRound, color: "#8E8E93" },
];

function activeIndex(pathname: string) {
  const found = [...NAV]
    .filter((n) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return found?.id ?? "home";
}

export function DoctorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeIndex(pathname);

  async function logout() {
    if (!isDemoMode) {
      try {
        // Surface-tagged: ends the cockpit session only, not the patient's.
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
    label: n.label,
    icon: n.icon,
    color: n.color,
  }));

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 pt-3 sm:px-6">
        <Link href="/doctor" aria-label="Doceeto doctor home">
          <Wordmark compact />
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            aria-label={isDemoMode ? "Exit demo" : "Sign out"}
            className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-surface/70 text-[var(--text-muted)] backdrop-blur transition-colors hover:text-[var(--text)]"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <LanguageSelector />
        </div>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:px-6 lg:pb-44 lg:pt-6">
        {children}
      </main>

      {/* Mobile floating iOS tab pill */}
      <nav className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4 lg:hidden">
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--glass-bg-strong)] p-1.5 shadow-[var(--elev-shadow-strong)] backdrop-blur-2xl">
          {NAV.map(({ id, href, label, icon: Icon }) => {
            const isOn = id === active;
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  "flex items-center gap-1.5 rounded-full transition-all",
                  isOn
                    ? "bg-[rgb(var(--c-espresso-700))] px-4 py-2.5 text-primary"
                    : "px-3.5 py-2.5 text-[var(--text-muted)] active:text-[var(--text)]",
                )}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={isOn ? 2.3 : 2} />
                {isOn && <span className="text-[13px] font-semibold">{label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop macOS dock */}
      <AppDock items={dockItems} activeId={active} />
    </div>
  );
}
