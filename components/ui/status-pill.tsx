import { cn } from "@/lib/utils/cn";

type Tone = "critical" | "warn" | "ok" | "idle" | "info";

const tones: Record<Tone, string> = {
  critical: "bg-terracotta/15 text-terracotta-300 ring-terracotta/30",
  warn: "bg-tan/15 text-tan ring-tan/30",
  ok: "bg-status-ok/15 text-status-ok ring-status-ok/30",
  idle: "bg-white/5 text-[var(--text-faint)] ring-white/10",
  info: "bg-salmon/10 text-salmon ring-salmon/25",
};

export function StatusPill({
  children,
  tone = "idle",
  dot = true,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "critical" && "bg-terracotta",
            tone === "warn" && "bg-tan",
            tone === "ok" && "bg-status-ok",
            tone === "idle" && "bg-[var(--text-faint)]",
            tone === "info" && "bg-salmon",
          )}
        />
      )}
      {children}
    </span>
  );
}
