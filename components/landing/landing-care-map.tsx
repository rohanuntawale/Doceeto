"use client";

import { Home, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The hero visual: who is near you right now, and one of them on their way.
 *
 * The headline is "Care that reaches you", which is a claim about DISTANCE.
 * So the visual is spatial — your home at the centre, real providers around
 * it at real minutes away, and a route drawing itself in from the one who
 * took the job. It replaced a stacked mock-up of chat cards, which described
 * the product in words the headline had already said.
 *
 * Two rules held it together:
 *
 *  • ONE moving thing. The route arc draws; everything else is still. A panel
 *    where four elements pulse at once reads as a screensaver, and the eye
 *    stops believing any of it.
 *  • COLOUR MEANS CADRE, nowhere else. Green is a doctor, blue is a nurse —
 *    the same two colours the app uses everywhere else. Nothing is tinted for
 *    decoration, so the legend needs no explaining.
 */

interface Provider {
  id: string;
  initials: string;
  name: string;
  detail: string;
  minutes: number;
  cadre: "doctor" | "nurse";
  /** Position in the field, as percentages. */
  x: number;
  y: number;
  /** The one who accepted. Exactly one, or the composition has no subject. */
  enRoute?: boolean;
}

/**
 * Real Nagpur distances for a city this app actually operates in. The minutes
 * are the point: "6 min" is a promise a landing page can be held to, and
 * "instant" is not.
 */
const PROVIDERS: Provider[] = [
  {
    id: "ananya",
    initials: "AS",
    name: "Dr Ananya Sharma",
    detail: "General medicine",
    minutes: 6,
    cadre: "doctor",
    x: 22,
    y: 20,
    enRoute: true,
  },
  {
    id: "rekha",
    initials: "RK",
    name: "Rekha Kadam",
    detail: "Vitals & dressing",
    minutes: 11,
    cadre: "nurse",
    x: 76,
    y: 33,
  },
  {
    id: "imran",
    initials: "IQ",
    name: "Dr Imran Qureshi",
    detail: "Paediatrics",
    minutes: 14,
    cadre: "doctor",
    x: 18,
    y: 74,
  },
  {
    id: "sunil",
    initials: "SM",
    name: "Sunil More",
    detail: "Injections",
    minutes: 19,
    cadre: "nurse",
    x: 74,
    y: 82,
  },
];

const HOME = { x: 50, y: 52 };

const cadreColor = (cadre: Provider["cadre"]) =>
  cadre === "nurse" ? "#2F7BC4" : "rgb(var(--accent-rgb))";

export function LandingCareMap() {
  const enRoute = PROVIDERS.find((p) => p.enRoute) ?? PROVIDERS[0];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-card">
      <div className="flex items-center justify-between px-6 pt-5">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
          Nagpur · online now
        </p>
        <p className="text-[11px] text-[var(--text-faint)]">within 15 km</p>
      </div>

      {/* The field. Warm rather than clinical: a person opening this page is
          usually worried, and a grey grid is not the tone to meet that with. */}
      <div className="relative mt-4 aspect-[5/6] w-full sm:aspect-[6/5] lg:aspect-[5/6]">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 55% at 50% 52%, rgb(var(--accent-rgb)/0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 82% 18%, rgb(var(--c-tan)/0.12), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5]"
          style={{
            // A ground texture, not a grid: streets would invite you to read
            // them, and these are not real streets.
            backgroundImage:
              "radial-gradient(circle, rgb(var(--c-sand)/0.35) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(ellipse 70% 65% at 50% 52%, #000 30%, transparent 85%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 65% at 50% 52%, #000 30%, transparent 85%)",
          }}
        />

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          {/* Reach rings — how far the request travels, drawn as distance
              rather than stated as a number. */}
          {/* Round in viewBox space, not on screen: preserveAspectRatio="none"
              is what keeps the SVG's coordinates identical to the pins'
              percentages, and it stretches these into the panel's own
              proportions on the way out. Pre-flattening them here would
              double the effect. */}
          {[19, 30, 41].map((r) => (
            <circle
              key={r}
              cx={HOME.x}
              cy={HOME.y}
              r={r}
              fill="none"
              stroke="rgb(var(--accent-rgb))"
              strokeWidth="0.25"
              opacity={0.22}
            />
          ))}

          {/* The route. The ONLY animated element on the panel: the dash
              travels from the doctor to the door, so "on the way" is shown
              rather than labelled. */}
          <path
            d={`M ${enRoute.x} ${enRoute.y} Q ${(enRoute.x + HOME.x) / 2 - 6} ${
              (enRoute.y + HOME.y) / 2 + 10
            } ${HOME.x} ${HOME.y}`}
            fill="none"
            stroke="rgb(var(--accent-rgb))"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeDasharray="3 2.5"
            className="animate-route motion-reduce:animate-none"
            opacity={0.85}
          />
        </svg>

        {/* Home. A square among circles, because it is the one fixed thing. */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${HOME.x}%`, top: `${HOME.y}%` }}
        >
          <span
            aria-hidden
            className="absolute inset-0 -m-3 animate-ping rounded-2xl bg-[rgb(var(--accent-rgb)/0.18)] motion-reduce:animate-none"
          />
          <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-[rgb(var(--accent-rgb)/0.35)] bg-[var(--bg)] shadow-soft">
            <Home className="h-5 w-5 text-[var(--accent)]" />
          </span>
          <span className="mt-2 block whitespace-nowrap text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            You
          </span>
        </div>

        {PROVIDERS.map((provider) => (
          <ProviderPin key={provider.id} provider={provider} />
        ))}
      </div>

      {/* One line of facts, not three cards. Each is something the app
          actually enforces — verification, a fixed fee, and the code the
          patient reads at the door to confirm the visit happened. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--border)] px-6 py-4 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
          Ops-verified providers
        </span>
        <span className="text-[var(--text-faint)]">·</span>
        <span>₹499 home visit, shown before you book</span>
        <span className="text-[var(--text-faint)]">·</span>
        <span>4-digit code confirms arrival</span>
      </div>
    </div>
  );
}

function ProviderPin({ provider }: { provider: Provider }) {
  const color = cadreColor(provider.cadre);

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${provider.x}%`, top: `${provider.y}%` }}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-[var(--bg)] py-1.5 pl-1.5 pr-3 shadow-soft",
          provider.enRoute ? "border-transparent" : "border-[var(--border)]",
        )}
        // The one en route carries a coloured ring; the rest sit quietly on the
        // hairline border. Emphasis by outline rather than by size, so the
        // composition keeps its rhythm.
        style={provider.enRoute ? { boxShadow: `0 0 0 1.5px ${color}` } : undefined}
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
          style={{ background: color }}
        >
          {provider.initials}
        </span>
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-[11px] font-semibold leading-tight text-[var(--text)]">
            {provider.name}
          </span>
          <span className="block whitespace-nowrap text-[10px] leading-tight text-[var(--text-muted)]">
            {provider.enRoute ? "On the way" : provider.detail} ·{" "}
            <span style={{ color }}>{provider.minutes} min</span>
          </span>
        </span>
      </div>
    </div>
  );
}
