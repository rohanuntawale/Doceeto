"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Info, Mail, Lock, LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/about", label: "About us", icon: <Info className="h-4 w-4" /> },
  { href: "/contact", label: "Contact", icon: <Mail className="h-4 w-4" /> },
  { href: "/register", label: "Register", icon: <UserPlus className="h-4 w-4" /> },
  { href: "/login", label: "Sign in", icon: <LogIn className="h-4 w-4" /> },
];

export function SiteMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-espresso-800 hover:text-cream"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="popover absolute right-0 z-[1000] mt-2 w-60 animate-fade-up overflow-hidden rounded-card p-1.5">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-cream"
              >
                {l.icon}
                {l.label}
              </Link>
            ))}

            <div className="my-1.5 h-px bg-[var(--border)]" />

            <Link
              href="/ops-signin"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-terracotta/10 hover:text-salmon"
            >
              <span className="flex items-center gap-2.5">
                <Lock className="h-4 w-4" />
                Ops sign in
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                admin
              </span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
