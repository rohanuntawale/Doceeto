export function EmptyState({
  title,
  desc,
  icon,
  action,
}: {
  title: string;
  desc?: string;
  icon?: React.ReactNode;
  /** A way OUT of the empty state — a Link or button. An empty screen is an
   *  invitation to act, so every terminal message should offer one. */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-[var(--border)] px-6 py-14 text-center">
      {icon && <div className="text-[var(--text-faint)]">{icon}</div>}
      <p className="mt-3 font-serif text-lg text-[var(--text)]">{title}</p>
      {desc && (
        <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">{desc}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
