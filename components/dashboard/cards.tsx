"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, TrendingUp, Activity, Target, ArrowUpRight, ArrowDownRight, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ── Trend badge + sparkline ── */

export function TrendBadge({ value, className }: { value: number; className?: string }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
        up
          ? "bg-[rgb(var(--c-status-ok))]/15 text-[rgb(var(--c-status-ok))]"
          : "bg-[rgb(var(--c-status-critical))]/15 text-[rgb(var(--c-status-critical))]",
        className,
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const w = 100;
  const h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 3) - 1.5}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("w-full", className)}>
      <polyline
        points={pts}
        fill="none"
        className="stroke-[rgb(var(--c-terracotta))]"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── Pill progress row (Akhrot "Captured / Synced / …" style) ── */

export interface ProgressItem {
  label: string;
  value: number; // 0–100
  display?: string;
}

export function ProgressRow({ items }: { items: ProgressItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label}>
          <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">{it.label}</p>
          <div className="relative h-8 overflow-hidden rounded-full fh-tile">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--c-terracotta))]"
              style={{ width: `${Math.max(6, Math.min(100, it.value))}%` }}
            />
            <span
              className={cn(
                "absolute inset-0 flex items-center px-3 text-xs font-semibold",
                it.value > 55 ? "justify-start text-[rgb(var(--c-on-accent))]" : "justify-end text-cream",
              )}
            >
              {it.display ?? `${it.value}%`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Circular gauge card ── */

export function GaugeCard({
  title,
  value,
  caption,
  trend,
  spark,
  footer,
}: {
  title: string;
  value: number;
  caption: string;
  trend?: number;
  spark?: number[];
  /** Extra content under the gauge — e.g. the health score's pillar breakdown. */
  footer?: ReactNode;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <section className="fh-card relative flex h-full min-h-[430px] flex-col overflow-hidden rounded-[28px] p-4 sm:p-5">
      <div className="pattern-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-cream">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[rgb(var(--c-terracotta))]/12 ring-1 ring-inset ring-[rgb(var(--c-terracotta))]/20">
            <Activity className="h-4 w-4 text-[rgb(var(--c-terracotta))]" />
          </span>
          <span className="truncate">{title}</span>
        </h3>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <div className="relative flex h-[204px] shrink-0 items-center justify-center sm:h-[218px]">
        <svg viewBox="0 0 120 120" className="h-[158px] w-[158px] -rotate-90 sm:h-[170px] sm:w-[170px]">
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-[rgb(var(--c-espresso-700))]" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className="stroke-[rgb(var(--c-terracotta))]"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-x-0 top-1/2 mx-auto w-[132px] -translate-y-1/2 text-center">
          <p className="text-[2.15rem] font-bold leading-none tracking-[-0.04em] text-cream">{value}%</p>
          <p className="mt-2 text-[11px] leading-[1.35] text-[var(--text-muted)]">{caption}</p>
        </div>
      </div>
      {spark && (
        <div className="relative h-7 shrink-0 opacity-90">
          <Sparkline data={spark} />
        </div>
      )}
      {footer && <div className="relative mt-auto border-t border-[var(--border)]/70 pt-3">{footer}</div>}
    </section>
  );
}

/* ── Weekly activity bars ── */

/** Long-form day names, so a selected bar reads as a day rather than a letter. */
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * A week of daily figures.
 *
 * Tapping a bar answers "what did I make on Thursday?" in place, which is the
 * question the chart provokes and previously could not answer. After three
 * taps it hands over to the wallet — by then the person is clearly auditing
 * their money, and a seven-bar sparkline is the wrong tool for that. The hint
 * appears before the jump, so the navigation is offered rather than sprung.
 *
 * `href` is optional: without it the card stays a read-only chart, which is
 * what the patient dashboard wants.
 */
export function ActivityCard({
  title,
  caption,
  data,
  labels = ["S", "M", "T", "W", "T", "F", "S"],
  trend,
  href,
  hrefLabel,
  formatValue = (n: number) => String(n),
  dayNames = DAY_NAMES,
}: {
  title: string;
  caption: string;
  data: number[];
  labels?: string[];
  trend?: number;
  /**
   * Optional destination for the full record, rendered as a LABELLED LINK
   * under the chart.
   *
   * It used to be wired to a tap counter: the third tap on any bar navigated
   * away. The caption said "tap a day", so that is exactly what people did —
   * and on the third one the dashboard vanished and the wallet appeared, with
   * no control anywhere that said it would. A chart that sometimes reads a
   * value and sometimes leaves the page is a chart you stop touching.
   *
   * Tapping a bar now only ever selects that bar. Navigation belongs to
   * something that names where it goes.
   */
  href?: string;
  /** Text for that link. */
  hrefLabel?: string;
  /** Renders the selected day's figure (e.g. as rupees). */
  formatValue?: (n: number) => string;
  dayNames?: string[];
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const max = Math.max(1, ...data);
  const peak = data.indexOf(max);

  /** Tap to read a day, tap again to clear it. That is the whole interaction. */
  function onPick(i: number) {
    setSelected((prev) => (prev === i ? null : i));
  }

  return (
    <section className="fh-card relative flex h-full flex-col overflow-hidden rounded-3xl p-4 sm:p-5">
      <div className="pattern-dots pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-cream">
          <TrendingUp className="h-4 w-4 shrink-0 text-[rgb(var(--c-salmon))]" />
          <span className="truncate">{title}</span>
        </h3>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>

      {/* The caption doubles as the readout: with a day selected it answers
          that day, otherwise it describes the series. One line, one job. */}
      <p className="relative mt-0.5 min-h-[1.25rem] text-xs text-[var(--text-muted)]">
        {selected !== null ? (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-semibold text-cream">{formatValue(data[selected])}</span>
            <span>on {dayNames[selected] ?? labels[selected]}</span>
            <button
              onClick={() => setSelected(null)}
              className="text-[rgb(var(--c-salmon))] underline decoration-dotted underline-offset-2"
            >
              Show week
            </button>
          </span>
        ) : (
          caption
        )}
      </p>

      <div className="relative mt-4 flex flex-1 items-end justify-between gap-1 sm:gap-2">
        {data.map((v, i) => {
          const on = selected === i;
          // With nothing selected the peak is highlighted; once a day is
          // picked, only that day is — two highlights would compete.
          const lit = selected === null ? i === peak : on;
          const Bar = (
            <>
              <div className="flex h-20 w-full items-end sm:h-24">
                <div
                  className={cn(
                    "mx-auto w-full max-w-[1.75rem] rounded-full transition-all duration-200",
                    lit
                      ? "bg-[rgb(var(--c-terracotta))]"
                      : "bg-[rgb(var(--c-espresso-600))]",
                    !lit && "group-hover:bg-[rgb(var(--c-espresso-500))]",
                  )}
                  style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] transition-colors",
                  on ? "font-semibold text-cream" : "text-[var(--text-faint)]",
                )}
              >
                {labels[i]}
              </span>
            </>
          );

          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={on}
              aria-label={`${dayNames[i] ?? labels[i]}: ${formatValue(v)}`}
              className="group flex flex-1 flex-col items-center gap-2 rounded-lg py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]"
            >
              {Bar}
            </button>
          );
        })}
      </div>

      {/* The way out, saying where it goes. */}
      {href && (
        <Link
          href={href}
          className="relative mt-3 inline-flex items-center gap-1 self-start text-[11px] font-medium text-[rgb(var(--c-salmon))] hover:underline"
        >
          {hrefLabel ?? "See the full record"}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </section>
  );
}

/* ── Goals checklist card (Akhrot "Setup tasks" style) ── */

export interface Goal {
  id: string;
  label: string;
  sub?: string;
  done?: boolean;
  /** Where this goal is completed. A goal with a destination navigates there
   *  instead of being a self-tick checkbox that goes nowhere. */
  href?: string;
}

export function GoalsCard({ title, goals }: { title: string; goals: Goal[] }) {
  // Only the hand-ticked ids live in state. Goals the app can answer for
  // itself (you're online, your profile is filled in) are read straight off
  // the props every render — seeding state from them once meant the list
  // froze at "nothing done", because the doctor record arrives on a later
  // poll than the first paint.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const isDone = (g: Goal) => Boolean(g.done) || ticked.has(g.id);
  const total = goals.length;
  const complete = goals.filter(isDone).length;

  return (
    <section className="fh-card overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-cream">
          <Target className="h-4 w-4 text-[rgb(var(--c-status-ok))]" /> {title}
        </h3>
        <span className="rounded-full bg-[rgb(var(--c-status-ok))]/15 px-2 py-0.5 text-xs font-semibold text-[rgb(var(--c-status-ok))]">
          {complete}/{total}
        </span>
      </div>
      <div className="mt-2 divide-y divide-[var(--border)]">
        {goals.map((g) => {
          const checked = isDone(g);
          // A goal the app already knows is complete isn't yours to untick.
          const owned = Boolean(g.done);
          const body = (
            <>
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
                  checked
                    ? "border-transparent bg-[rgb(var(--c-status-ok))] text-white"
                    : "border-[var(--border)] text-transparent",
                )}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[13px] font-medium", checked ? "text-[var(--text-faint)] line-through" : "text-cream")}>
                  {g.label}
                </span>
                {g.sub && <span className="block truncate text-[11px] text-[var(--text-muted)]">{g.sub}</span>}
              </span>
            </>
          );
          const rowCls =
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-default disabled:hover:bg-transparent";
          // An unfinished goal with a destination takes you where it's done.
          if (g.href && !checked) {
            return (
              <Link key={g.id} href={g.href} className={rowCls}>
                {body}
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
              </Link>
            );
          }
          return (
            <button
              key={g.id}
              disabled={owned}
              aria-pressed={checked}
              onClick={() =>
                setTicked((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.id)) next.delete(g.id);
                  else next.add(g.id);
                  return next;
                })
              }
              className={rowCls}
            >
              {body}
            </button>
          );
        })}
      </div>
    </section>
  );
}
