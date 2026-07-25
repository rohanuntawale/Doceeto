"use client";

import { useState } from "react";
import { Check, TrendingUp, Activity, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
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
}: {
  title: string;
  value: number;
  caption: string;
  trend?: number;
  spark?: number[];
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <section className="fh-card relative flex h-full flex-col overflow-hidden rounded-3xl p-5">
      <div className="pattern-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-cream">
          <Activity className="h-4 w-4 text-[rgb(var(--c-terracotta))]" /> {title}
        </h3>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <div className="relative mx-auto mt-3 grid flex-1 place-items-center">
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
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
        <div className="absolute text-center">
          <p className="text-2xl font-bold text-cream">{value}%</p>
          <p className="text-[11px] text-[var(--text-muted)]">{caption}</p>
        </div>
      </div>
      {spark && (
        <div className="relative mt-2 h-7 opacity-90">
          <Sparkline data={spark} />
        </div>
      )}
    </section>
  );
}

/* ── Weekly activity bars ── */

export function ActivityCard({
  title,
  caption,
  data,
  labels = ["S", "M", "T", "W", "T", "F", "S"],
  trend,
}: {
  title: string;
  caption: string;
  data: number[];
  labels?: string[];
  trend?: number;
}) {
  const max = Math.max(1, ...data);
  const peak = data.indexOf(max);
  return (
    <section className="fh-card relative flex h-full flex-col overflow-hidden rounded-3xl p-5">
      <div className="pattern-dots pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-cream">
          <TrendingUp className="h-4 w-4 text-[rgb(var(--c-salmon))]" /> {title}
        </h3>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p className="relative mt-0.5 text-xs text-[var(--text-muted)]">{caption}</p>
      <div className="relative mt-4 flex flex-1 items-end justify-between gap-2">
        {data.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-24 w-full items-end">
              <div
                className={cn(
                  "w-full rounded-full",
                  i === peak ? "bg-[rgb(var(--c-terracotta))]" : "bg-[rgb(var(--c-espresso-600))]",
                )}
                style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-faint)]">{labels[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Goals checklist card (Akhrot "Setup tasks" style) ── */

export interface Goal {
  id: string;
  label: string;
  sub?: string;
  done?: boolean;
}

export function GoalsCard({ title, goals }: { title: string; goals: Goal[] }) {
  const [done, setDone] = useState<Set<string>>(
    () => new Set(goals.filter((g) => g.done).map((g) => g.id)),
  );
  const total = goals.length;
  const complete = goals.filter((g) => done.has(g.id)).length;

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
          const isDone = done.has(g.id);
          return (
            <button
              key={g.id}
              onClick={() =>
                setDone((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.id)) next.delete(g.id);
                  else next.add(g.id);
                  return next;
                })
              }
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
                  isDone
                    ? "border-transparent bg-[rgb(var(--c-status-ok))] text-white"
                    : "border-[var(--border)] text-transparent",
                )}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[13px] font-medium", isDone ? "text-[var(--text-faint)] line-through" : "text-cream")}>
                  {g.label}
                </span>
                {g.sub && <span className="block truncate text-[11px] text-[var(--text-muted)]">{g.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
