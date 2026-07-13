"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Stethoscope, Pill, RotateCcw, ArrowLeftRight } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { cn } from "@/lib/utils/cn";
import { isDemoMode } from "@/lib/config";
import { resetTestData } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";

const nav = [
  { href: "/patient", label: "Home", icon: <Home className="h-4 w-4" /> },
  { href: "/patient/doctors", label: "Doctors", icon: <Stethoscope className="h-4 w-4" /> },
  { href: "/patient/medicine", label: "Medicine", icon: <Pill className="h-4 w-4" /> },
];

export function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  function reset() {
    resetTestData();
    toast.push({ tone: "info", title: "Test data cleared", desc: "Everything is back to empty." });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-24 md:px-0">
      {/* App bar */}
      <header className="sticky top-0 z-30 -mx-4 flex items-center justify-between border-b border-[var(--border)] bg-espresso/85 px-4 py-3 backdrop-blur md:mx-0">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1">
          {isDemoMode && (
            <button
              onClick={reset}
              title="Clear test data"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-espresso-800 hover:text-cream"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          <button
            onClick={() => router.push("/doctor")}
            title="Open the doctor view"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-espresso-800 hover:text-cream"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Doctor view
          </button>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="flex-1 py-5">{children}</main>

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
