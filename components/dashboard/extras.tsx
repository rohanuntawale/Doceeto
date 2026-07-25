"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Newspaper,
  HelpCircle,
  ChevronDown,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Clock,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Role = "patient" | "doctor";

/* ── Sample content (static for now; wire to a CMS/feed later) ── */

const UPDATES: Record<Role, { icon: React.ReactNode; label: string; value: string; color: string }[]> = {
  patient: [
    { icon: <ShieldCheck className="h-4 w-4" />, label: "Verified doctors", value: "1,200+", color: "#7C8B5E" },
    { icon: <Clock className="h-4 w-4" />, label: "Avg. arrival", value: "24 min", color: "#C0692F" },
    { icon: <Sparkles className="h-4 w-4" />, label: "Home visits till", value: "11 PM", color: "#C99A4B" },
  ],
  doctor: [
    { icon: <ArrowUpRight className="h-4 w-4" />, label: "Instant payout", value: "< 2 min", color: "#7C8B5E" },
    { icon: <Clock className="h-4 w-4" />, label: "Peak hours", value: "8–11 PM", color: "#C0692F" },
    { icon: <Sparkles className="h-4 w-4" />, label: "Platform fee", value: "15%", color: "#C99A4B" },
  ],
};

const NEWS: Record<Role, { tag: string; title: string; time: string; color: string }[]> = {
  patient: [
    { tag: "Health", title: "Seasonal flu cases rising in Nagpur — stay hydrated", time: "2h", color: "#C0692F" },
    { tag: "Wellness", title: "5 monsoon symptoms you shouldn't ignore", time: "5h", color: "#7C8B5E" },
    { tag: "Doceeto", title: "Home visits now available till 11 PM daily", time: "1d", color: "#C99A4B" },
  ],
  doctor: [
    { tag: "Platform", title: "Instant payouts now settle in under 2 minutes", time: "3h", color: "#C0692F" },
    { tag: "Guidelines", title: "Updated teleconsult best-practices for 2026", time: "6h", color: "#7C8B5E" },
    { tag: "Demand", title: "Peak request hours are 8–11 PM this week", time: "1d", color: "#C99A4B" },
  ],
};

const FAQS: Record<Role, { q: string; a: string }[]> = {
  patient: [
    { q: "How do home visits work?", a: "Pick a doctor or let us match you. They come to your address; pay online or cash after the visit." },
    { q: "What if it's an emergency?", a: "Press SOS on your home screen — an ambulance and the nearest doctor get your live location instantly." },
    { q: "Is my health data private?", a: "Yes. Your records are yours; only a doctor you book sees the details relevant to your visit." },
  ],
  doctor: [
    { q: "How do I get paid?", a: "Earnings land in your Doceeto wallet after each completed visit. Withdraw to your bank instantly." },
    { q: "How are gigs assigned?", a: "Go online to appear on the patient map. Accept requests directed to you or open broadcasts nearby." },
    { q: "What is the commission?", a: "A flat 15% platform fee per consult. The rest is yours, shown transparently in your wallet." },
  ],
};

/* ── Cards ── */

export function QuickUpdates({ role }: { role: Role }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {UPDATES[role].map((u) => (
        <div key={u.label} className="fh-card rounded-2xl p-3.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-full"
            style={{ background: `${u.color}22`, color: u.color }}
          >
            {u.icon}
          </span>
          <p className="mt-2 text-base font-bold text-cream">{u.value}</p>
          <p className="text-[11px] leading-tight text-[var(--text-muted)]">{u.label}</p>
        </div>
      ))}
    </div>
  );
}

export function NewsCard({ role }: { role: Role }) {
  return (
    <section className="fh-card overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-cream">
          <Newspaper className="h-4 w-4 text-[rgb(var(--c-terracotta))]" /> Latest news
        </h3>
        <span className="text-xs text-[var(--text-faint)]">Today</span>
      </div>
      <div className="mt-2 divide-y divide-[var(--border)]">
        {NEWS[role].map((n) => (
          <button key={n.title} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold"
              style={{ background: `${n.color}22`, color: n.color }}
            >
              {n.tag.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: n.color }}>
                  {n.tag}
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">· {n.time}</span>
              </span>
              <span className="mt-0.5 block truncate text-[13px] font-medium text-cream">{n.title}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function FaqCard({ role }: { role: Role }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="fh-card overflow-hidden rounded-3xl">
      <h3 className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-cream">
        <HelpCircle className="h-4 w-4 text-[rgb(var(--c-salmon))]" /> FAQs
      </h3>
      <div className="mt-2 divide-y divide-[var(--border)]">
        {FAQS[role].map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="flex-1 text-[13px] font-medium text-cream">{f.q}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <p className="animate-fade-up px-4 pb-3.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export interface HistoryItem {
  id: string;
  title: string;
  sub: string;
  time?: string;
  color?: string;
}

export function HistoryCard({
  title = "Recent activity",
  items,
  emptyText = "Nothing here yet",
  href,
}: {
  title?: string;
  items: HistoryItem[];
  emptyText?: string;
  href?: string;
}) {
  return (
    <section className="fh-card overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-cream">
          <History className="h-4 w-4 text-[rgb(var(--c-tan))]" /> {title}
        </h3>
        {href && (
          <Link href={href} className="text-xs font-medium text-[rgb(var(--c-terracotta))]">
            See all
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-[var(--text-faint)]">{emptyText}</p>
      ) : (
        <div className="mt-2 divide-y divide-[var(--border)]">
          {items.slice(0, 4).map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ background: `${it.color ?? "#C0692F"}22`, color: it.color ?? "#C0692F" }}
              >
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-cream">{it.title}</span>
                <span className="block truncate text-[11px] text-[var(--text-muted)]">{it.sub}</span>
              </span>
              {it.time && <span className="text-[10px] text-[var(--text-faint)]">{it.time}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Convenience: the full extras stack for a dashboard. */
export function DashboardExtras({ role }: { role: Role }) {
  return (
    <div className="space-y-4">
      <QuickUpdates role={role} />
      <NewsCard role={role} />
      <FaqCard role={role} />
    </div>
  );
}
