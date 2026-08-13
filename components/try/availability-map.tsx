"use client";

/**
 * Who is free right now, on a proximity map — names only.
 *
 * ── Why the pins are not real positions ──
 *
 * /api/public returns no coordinates, on purpose: a provider's live lat/lng is
 * the most sensitive field on the row, and publishing it to anyone with a URL
 * would say where a named person is standing right now. That protection is
 * worth more than an accurate preview, so the pins here are laid out by index
 * on a golden-angle spiral, and the caption says so rather than letting a ring
 * of dots imply a street map.
 *
 * What IS real: who is online, how many, and their names. That is the fact the
 * preview exists to show — the map is the frame around it.
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, MapPin } from "lucide-react";
import type { PublicProvider } from "@/components/try/provider-preview";
import { cn } from "@/lib/utils/cn";

type Payload = {
  providers: PublicProvider[];
  total: number;
  availableNow: number;
};

/** More than this and the ring turns into a smudge; the rest get a count. */
const MAX_PINS = 8;

/** Golden angle, so consecutive pins never stack however many there are. */
const GOLDEN = 137.508;

function pinPosition(index: number) {
  const angle = (index * GOLDEN * Math.PI) / 180;
  // Push outward as the index grows, held inside the box so no pin clips.
  const radius = 19 + (index % 3) * 9 + Math.min(index, 6) * 0.8;
  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius * 0.82}%`,
  };
}

export function AvailabilityMap({ cadre }: { cadre: "doctor" | "nurse" }) {
  const { data, isLoading } = useQuery<Payload>({
    // Same key as ProviderPreview's non-urgent query, so the map and the list
    // below it share one request instead of each firing their own.
    queryKey: ["public-providers", cadre, false],
    queryFn: async () => {
      const res = await fetch(`/api/public?entity=providers&cadre=${cadre}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load providers right now.");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const online = (data?.providers ?? []).filter((p) => p.available);
  const shown = online.slice(0, MAX_PINS);
  const overflow = online.length - shown.length;
  const isNurse = cadre === "nurse";

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      aria-label={`${isNurse ? "Nurses" : "Doctors"} available now`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-ok opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-ok" />
          </span>
          Available now
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          {isLoading
            ? "Checking…"
            : `${online.length} of ${data?.total ?? 0} ${isNurse ? "nurses" : "doctors"} free to take a request`}
        </p>
      </header>

      {/* The radar is square on purpose. Percentage ring sizes inside a wide,
          short box give ellipses that bleed off both edges — the rings have to
          sit in a box whose width and height are the same. */}
      <div className="mt-5 overflow-hidden rounded-2xl bg-[var(--bg)] p-4">
        <div className="relative mx-auto aspect-square w-full max-w-[30rem]">
          {/* Rings */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {[0.34, 0.56, 0.78, 1].map((scale, i) => (
              <motion.span
                key={scale}
                // The -50% offsets live in the motion props, not in Tailwind
                // classes: framer writes its own inline `transform` for scale,
                // which silently wins over -translate-x-1/2 and drops every
                // ring down and right of centre.
                initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                transition={{ duration: 0.8, delay: i * 0.08 }}
                className="absolute left-1/2 top-1/2 rounded-full border border-[var(--border)]"
                style={{
                  width: `${scale * 92}%`,
                  height: `${scale * 92}%`,
                }}
              />
            ))}
            <span className="pattern-dots absolute inset-0 opacity-30" />
          </div>

          {/* You, at the centre */}
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-soft">
              <MapPin className="h-5 w-5 text-[var(--accent)]" />
            </span>
            <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              Your area
            </span>
          </div>

          {isLoading && (
            <div className="absolute inset-0 grid place-items-center text-[var(--text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!isLoading && !online.length && (
            <div className="absolute inset-x-6 bottom-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                Nobody is free this minute. The ring fills as{" "}
                {isNurse ? "nurses" : "doctors"} come online.
              </p>
            </div>
          )}

          {/* One pin per online provider — the name, and nothing else. */}
          {shown.map((provider, i) => {
            const pos = pinPosition(i);
            return (
              <motion.div
                key={provider.id}
                // Same reason as the rings: centring has to ride along with
                // the scale, or framer's inline transform discards it.
                initial={{ opacity: 0, scale: 0.8, x: "-50%", y: "-50%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                transition={{
                  duration: 0.45,
                  delay: 0.15 + i * 0.07,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute z-20"
                style={pos}
              >
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-full border bg-[var(--surface)] py-1.5 pl-1.5 pr-3 shadow-soft",
                    isNurse
                      ? "border-[#2F7BC4]/35"
                      : "border-[rgb(var(--accent-rgb)/0.35)]",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      isNurse ? "bg-[#2F7BC4]" : "bg-status-ok",
                    )}
                  />
                  <span className="max-w-[9rem] truncate text-xs font-semibold text-[var(--text)]">
                    {provider.fullName}
                  </span>
                </span>
              </motion.div>
            );
          })}

          {overflow > 0 && (
            <span className="absolute bottom-0 right-0 z-20 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
              +{overflow} more
            </span>
          )}
        </div>
      </div>

      {/* Says plainly that the placement is not geography. Without this the
          ring reads as a street map and quietly makes a claim we refuse to. */}
      <p className="mt-3 text-xs text-[var(--text-faint)]">
        Names and availability are live. Pin placement is illustrative — real
        distance and location appear once you have an account.
      </p>
    </section>
  );
}
