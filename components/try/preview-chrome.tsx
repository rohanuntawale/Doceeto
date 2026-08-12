"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * The band that sits under every preview page.
 *
 * It has one job and states it plainly: you are looking at the real thing, and
 * here is the line where it stops. A preview that hides the fact it is a
 * preview wastes the visitor's time twice — once when they try to act and
 * can't, and again when they have to work out why.
 *
 * `next` carries the page they were on into sign-in, so signing up returns
 * them here rather than dumping them on a dashboard.
 */
export function PreviewBanner({
  can,
  needsAccount,
}: {
  /** What works without an account, in the visitor's words. */
  can: string;
  /** What doesn't, and why it's worth the sign-up. */
  needsAccount: string;
}) {
  const pathname = usePathname();

  return (
    <div className="rounded-card border border-[rgb(var(--accent-rgb)/0.25)] bg-[rgb(var(--accent-rgb)/0.06)] px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text)]">
            <span className="font-semibold">Preview.</span> {can}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{needsAccount}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
            <Button variant="outline" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">
              Create account
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { href: "/try/doctors", label: "Doctors" },
  { href: "/try/nurses", label: "Nurses" },
  { href: "/try/urgent", label: "Urgent care" },
  { href: "/try/checker", label: "Symptom check" },
];

/** Lets someone who came for one preview find the other three. */
export function PreviewTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-terracotta text-on-accent"
                : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
