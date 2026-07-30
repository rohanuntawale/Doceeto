"use client";

import { useEffect, useRef } from "react";
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
  // The symptom checker lives under the "care" tab even though its URL
  // isn't a prefix of /patient/doctors — without this it lit up Home.
  if (pathname.startsWith("/patient/care")) return "care";
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

  // Four tabs plus a translated label can outgrow a 320px phone (Hindi and
  // Marathi labels run long); keep the active tab in view so clipped tabs
  // stay discoverable — same treatment as the doctor shell.
  const pillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pillRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    <div className="min-h-screen">
      {/* Top bar — brand + language. Solid glass at exactly --chrome-top tall,
          so scrolled content never collides with the controls floating on it. */}
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-espresso/85 px-4 backdrop-blur-xl sm:px-6">
        <Link href="/patient" aria-label="Doceeto home">
          <Wordmark compact />
        </Link>
        <LanguageSelector />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(var(--chrome-dock)+1.75rem)] pt-4 sm:px-6 lg:pt-6">
        {children}
      </main>

      {/* Bottom scrim — pages fade out into the background under the floating
          dock instead of colliding with it at full strength. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-24 lg:h-32"
        style={{ background: "linear-gradient(to top, var(--bg) 25%, transparent)" }}
      />

      {/* Mobile floating iOS tab pill. On narrow phones the pill scrolls
          (scrollbar hidden, edges fade as a cue) instead of squashing the
          icons or spilling past the viewport. */}
      <nav className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3 lg:hidden">
        <div
          ref={pillRef}
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--glass-bg-strong)] p-1.5 shadow-[var(--elev-shadow-strong)] backdrop-blur-2xl [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map(({ id, href, labelKey, icon: Icon }) => {
            const isOn = id === active;
            return (
              <Link
                key={href}
                href={href}
                aria-label={t(labelKey)}
                data-active={isOn || undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full transition-all",
                  isOn
                    ? "bg-[rgb(var(--c-espresso-700))] px-4 py-2.5 text-primary"
                    : "px-3.5 py-2.5 text-[var(--text-muted)] active:text-[var(--text)]",
                )}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={isOn ? 2.3 : 2} />
                {isOn && (
                  <span className="whitespace-nowrap text-[13px] font-semibold">{t(labelKey)}</span>
                )}
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
