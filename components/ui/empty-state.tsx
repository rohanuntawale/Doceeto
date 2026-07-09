export function EmptyState({
  title,
  desc,
  icon,
  kanji,
}: {
  title: string;
  desc?: string;
  icon?: React.ReactNode;
  kanji?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-[var(--border)] px-6 py-14 text-center">
      {kanji ? (
        <span className="font-jp text-4xl text-[var(--text-faint)]">
          {kanji}
        </span>
      ) : (
        <div className="text-[var(--text-faint)]">{icon}</div>
      )}
      <p className="mt-3 font-serif text-lg text-[var(--text)]">{title}</p>
      {desc && (
        <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">{desc}</p>
      )}
    </div>
  );
}
