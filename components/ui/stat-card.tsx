import { cn } from "@/lib/utils/cn";

/**
 * The signature Iyashi metric tile: a large serif number over a
 * tracked, uppercase label — straight from the deck's stat slides.
 */
export function StatCard({
  value,
  label,
  sub,
  accent = false,
  className,
  icon,
}: {
  value: React.ReactNode;
  label: string;
  sub?: string;
  accent?: boolean;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card sm:p-5",
        className,
      )}
    >
      {/* accent hairline */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px",
          accent ? "bg-terracotta" : "bg-[var(--border)]",
        )}
      />
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
    </div>
  );
}
