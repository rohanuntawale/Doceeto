"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, Search, Stethoscope, Pill, User } from "lucide-react";
import { LayoutGroup, motion } from "framer-motion";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguageSelector } from "@/components/ui/language-selector";
import { MEDICINE_ENABLED } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import { resetPatientSession } from "@/lib/hooks/use-current-patient";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

/**
 * Patient shell. Mobile keeps a compact thumb-friendly tab pill; desktop uses
 * an animated, in-app navigation bar so pages never compete with a floating
 * dock for visual attention.
 */
const NAV = [
  { id: "home", href: "/patient", labelKey: "nav.home", icon: Home, color: "#0A84FF", exact: true },
  /**
   * The symptom checker, as its own destination.
   *
   * It was reachable only through the "I need care" card on the dashboard,
   * which meant that from any other screen the way back to it was: go home,
   * find the card, scroll to it. For the one tool a patient opens when they
   * are worried and not yet sure what they need, that is the wrong number of
   * steps — and it sat under a tab labelled "Find care" that actually opens
   * the doctor list, so nothing in the chrome named it at all.
   *
   * It goes SECOND, before browsing doctors: "I don't know what's wrong" comes
   * before "show me a cardiologist" for most people arriving here.
   */
  {
    id: "check",
    href: "/patient/care",
    labelKey: "nav.check",
    icon: Stethoscope,
    color: "#FF9F0A",
  },
  { id: "care", href: "/patient/doctors", labelKey: "nav.care", icon: Search, color: "#30D158" },
  // Medicine hidden while MEDICINE_ENABLED is off.
  ...(MEDICINE_ENABLED
    ? [{ id: "meds", href: "/patient/medicine", labelKey: "nav.meds", icon: Pill, color: "#FF9F0A" }]
    : []),
  { id: "account", href: "/patient/account", labelKey: "nav.account", icon: User, color: "#5E5CE6" },
];

function activeIndex(pathname: string) {
  // The special case for /patient/care is gone: the checker now has its own
  // tab whose href IS that path, so the ordinary longest-prefix match below
  // resolves it. It used to be borrowed by "Find care", which lit the doctor
  // list while you were in the checker.
  // Longest matching href wins; home is exact.
  const found = [...NAV]
    .filter((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return found?.id ?? "home";
}

export function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const active = activeIndex(pathname);

  /**
   * End the PATIENT session only.
   *
   * apiFetch tags the call with the surface it was made from, so a browser
   * holding both a patient and a doctor session signs out of this one and
   * leaves the cockpit alone — which is the whole reason sessions are stored
   * per role. A plain fetch here would let the server pick, and the doctor
   * could find themselves signed out by their own patient account.
   */
  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore — the redirect below still gets them out */
    }
    resetPatientSession();
    router.push("/login");
    router.refresh();
  }

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
    // The app keeps the terracotta accent; green is the public brand.
    <div className="min-h-screen app-accent-warm">
      {/* Top bar, brand + language. Solid glass at exactly --chrome-top tall,
          so scrolled content never collides with the controls floating on it. */}
      <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-espresso/85 px-4 backdrop-blur-xl sm:px-6">
        <Link href="/patient" aria-label="Doceeto home">
          <Wordmark compact />
        </Link>
        <PatientFramerNav
          items={NAV.map((item) => ({ ...item, label: t(item.labelKey) }))}
          activeId={active}
        />
        {/* Sign out then language, the same order, icon and styling as the
            doctor cockpit's top bar. Someone who holds both a patient and a
            provider account should not have to re-learn where the exit is
            when they switch. */}
        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
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

      {/* Bottom scrim, pages fade out into the background under the floating
          dock instead of colliding with it at full strength. */}
      {pathname.startsWith("/patient/care") ? null : (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-24 lg:h-32"
          style={{ background: "linear-gradient(to top, var(--bg) 25%, transparent)" }}
        />
      )}

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

    </div>
  );
}

function PatientFramerNav({
  items,
  activeId,
}: {
  items: Array<(typeof NAV)[number] & { label: string }>;
  activeId: string;
}) {
  return (
    <LayoutGroup id="patient-navigation">
      <nav
        aria-label="Patient navigation"
        className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/90 p-1 shadow-[0_10px_30px_rgb(16_45_35/0.08)] backdrop-blur-xl lg:flex"
      >
        {items.map(({ id, href, label, icon: Icon }) => {
          const selected = id === activeId;
          return (
            <Link
              key={id}
              href={href}
              aria-current={selected ? "page" : undefined}
              className="relative flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors"
            >
              {selected ? (
                <motion.span
                  layoutId="patient-nav-active"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-full bg-[#153d32] shadow-[0_5px_14px_rgb(21_61_50/0.22)]"
                />
              ) : null}
              <Icon className={cn("relative h-4 w-4", selected ? "text-white" : "text-[var(--text-muted)]")} />
              <span className={cn("relative", selected ? "text-white" : "text-[var(--text-muted)]")}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
