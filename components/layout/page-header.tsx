export function PageHeader({
  kanji,
  label,
  title,
  action,
}: {
  kanji?: string;
  label: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {kanji && <span className="font-jp text-sm text-salmon">{kanji}</span>}
          <span className="label">{label}</span>
        </div>
        <h1 className="mt-1.5 font-serif text-3xl text-cream md:text-4xl">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
