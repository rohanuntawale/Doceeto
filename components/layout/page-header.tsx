export function PageHeader({
  label,
  title,
  action,
}: {
  label: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="label">{label}</span>
        </div>
        <h1 className="mt-1.5 font-serif text-2xl text-cream sm:text-3xl md:text-4xl">
          {title}
        </h1>
      </div>
      {action && <div className="w-full sm:w-auto sm:shrink-0">{action}</div>}
    </div>
  );
}
