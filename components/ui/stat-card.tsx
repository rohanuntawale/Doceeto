import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * The signature Doceeto metric tile: a large serif number over a
 * tracked, uppercase label, straight from the deck's stat slides.
 *
 * Pass `href` to make the whole tile a link to the screen that breaks the
 * number down — the metric then doubles as the way in to its detail.
 */
export function StatCard({
  value,
  label,
  sub,
  accent = false,
  className,
  icon,
  href,
  dense = false,
}: {
  value: React.ReactNode;
  label: string;
  sub?: string;
  accent?: boolean;
  className?: string;
  icon?: React.ReactNode;
  href?: string;
  /**
   * Compact KPI row: the icon sits beside the label and the number steps
   * down a size or two. A dashboard that stacks four of these wants a strip,
   * not four poster-sized numbers.
   */
  dense?: boolean;
}) {
  const tileClass = cn(
    "relative block overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-card",
    dense ? "p-4" : "p-4 sm:p-5",
    href &&
      "transition-colors hover:border-[rgb(var(--c-terracotta))]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]",
    className,
  );

  const hairline = (
    <div
      className={cn(
        "absolute inset-x-0 top-0 h-px",
        accent ? "bg-terracotta" : "bg-[var(--border)]",
      )}
    />
  );

  const body = dense ? (
    <>
      {hairline}
      <div className="flex items-center gap-1.5 text-[var(--text-faint)]">
        {icon}
        <span className="label truncate leading-none">{label}</span>
      </div>
      <div
        className={cn(
          "metric mt-2 text-2xl leading-none sm:text-[1.75rem]",
          accent ? "text-salmon" : "text-[var(--text)]",
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 truncate text-xs text-[var(--text-faint)]">{sub}</div>
      )}
    </>
  ) : (
    <>
      {hairline}
      {icon && (
        <div className="mb-2.5 text-[var(--text-faint)] sm:mb-3">{icon}</div>
      )}
      <div
        className={cn(
          "metric text-3xl sm:text-4xl md:text-[2.75rem]",
          accent ? "text-salmon" : "text-[var(--text)]",
        )}
      >
        {value}
      </div>
      <div className="label mt-2 leading-tight">{label}</div>
      {sub && (
        <div className="mt-1 text-xs text-[var(--text-faint)]">{sub}</div>
      )}
    </>
  );

  return href ? (
    <Link href={href} className={tileClass}>
      {body}
    </Link>
  ) : (
    <div className={tileClass}>{body}</div>
  );
}
