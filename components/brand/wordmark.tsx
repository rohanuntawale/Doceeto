import { cn } from "@/lib/utils/cn";

/** Iyashi wordmark: kanji 癒 mark + serif name, as on the deck cover. */
export function Wordmark({
  className,
  subtle = false,
}: {
  className?: string;
  subtle?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-md font-jp text-lg leading-none",
          subtle
            ? "bg-white/5 text-salmon"
            : "bg-terracotta text-cream shadow-[0_0_18px_rgba(193,90,56,0.45)]",
        )}
        aria-hidden
      >
        癒
      </span>
      <div className="leading-none">
        <div className="font-serif text-lg tracking-tight text-[var(--text)]">
          Iyashi
        </div>
        <div className="font-jp text-[10px] tracking-widest text-[var(--text-faint)]">
          癒し · HEALING
        </div>
      </div>
    </div>
  );
}
