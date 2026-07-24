import { cn } from "@/lib/utils/cn";

/** Doceeto wordmark — serif name with the signature gold "ee", beside a
 *  ring-and-dot mark that echoes the mascot's head-mirror (per the deck).
 *  `compact` renders a single-line lockup for app bars. */
export function Wordmark({
  className,
  subtle = false,
  compact = false,
}: {
  className?: string;
  subtle?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark subtle={subtle} />
      {compact ? (
        <Name className="text-lg" />
      ) : (
        <div className="leading-none">
          <Name className="text-lg" />
          <div className="mt-1 text-[10px] tracking-[0.14em] text-[var(--text-faint)]">
            Care that reaches you
          </div>
        </div>
      )}
    </div>
  );
}

/** The "Doc·ee·to" serif lockup with the middle pair in gold. */
export function Name({ className }: { className?: string }) {
  return (
    <span className={cn("font-serif tracking-tight text-[var(--text)]", className)}>
      Doc<span className="text-salmon">ee</span>to
    </span>
  );
}

/** Small circular emblem: a soft green disc with a gold reflector ring +
 *  dot — a quiet nod to the doctor mascot's head-mirror. */
export function BrandMark({ subtle = false, className }: { subtle?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-inset",
        subtle ? "bg-white/5 ring-white/10" : "bg-white/8 ring-white/12",
        className,
      )}
      aria-hidden
    >
      <span className="grid h-4 w-4 place-items-center rounded-full ring-[1.5px] ring-inset ring-salmon">
        <span className="h-1 w-1 rounded-full bg-salmon" />
      </span>
    </span>
  );
}
