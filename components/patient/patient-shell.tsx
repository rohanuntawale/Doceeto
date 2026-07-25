"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Pill, User } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguageSelector } from "@/components/ui/language-selector";
import { AppDock, type DockItem } from "@/components/layout/app-dock";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

/**
 * Patient shell. Mobile: a floating iOS-style tab pill. Desktop (lg+): a
 * macOS magnifying dock at the bottom instead of a sidebar.
 */
const NAV = [
  { id: "home", href: "/patient", labelKey: "nav.home", icon: Home, color: "#0A84FF", exact: true },
  { id: "care", href: "/patient/doctors", labelKey: "nav.care", icon: Search, color: "#30D158" },
  { id: "meds", href: "/patient/medicine", labelKey: "nav.meds", icon: Pill, color: "#FF9F0A" },
  { id: "account", href: "/patient/account", labelKey: "nav.account", icon: User, color: "#5E5CE6" },
];

function activeIndex(pathname: string) {
  // Longest matching href wins; home is exact.
  const found = [...NAV]
    .filter((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return found?.id ?? "home";
}

export function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useT();
  const active = activeIndex(pathname);

  const dockItems: DockItem[] = NAV.map((n) => ({
    id: n.id,
    href: n.href,
    label: t(n.labelKey),
    icon: n.icon,
    color: n.color,
  }));

  return (
    <div className="min-h-screen">
      {/* Top bar — brand + language */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 pt-3 sm:px-6">
        <Link href="/patient" aria-label="Doceeto home">
          <Wordmark compact />
        </Link>
        <LanguageSelector />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:px-6 lg:pb-44 lg:pt-6">
        {children}
      </main>

      {/* Mobile floating iOS tab pill */}
      <nav className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4 lg:hidden">
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--glass-bg-strong)] p-1.5 shadow-[var(--elev-shadow-strong)] backdrop-blur-2xl">
          {NAV.map(({ id, href, labelKey, icon: Icon }) => {
            const isOn = id === active;
            return (
              <Link
                key={href}
                href={href}
                aria-label={t(labelKey)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full transition-all",
                  isOn
                    ? "bg-[rgb(var(--c-espresso-700))] px-4 py-2.5 text-primary"
                    : "px-3.5 py-2.5 text-[var(--text-muted)] active:text-[var(--text)]",
                )}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={isOn ? 2.3 : 2} />
                {isOn && <span className="text-[13px] font-semibold">{t(labelKey)}</span>}
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
