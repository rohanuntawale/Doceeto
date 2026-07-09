import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  label,
  action,
  className,
}: {
  title?: React.ReactNode;
  label?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        {label && <div className="label mb-1">{label}</div>}
        {title && (
          <h3 className="truncate font-serif text-lg text-[var(--text)]">
            {title}
          </h3>
        )}
      </div>
      {action}
    </div>
  );
}
