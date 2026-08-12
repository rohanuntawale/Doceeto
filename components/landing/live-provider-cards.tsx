"use client";

/**
 * The two cards in the showcase's patient view, built from the real roster.
 *
 * They used to be hardcoded — a "Dr. Rajesh Varma" and a "Sister Meera Nair"
 * who do not exist, priced at numbers nobody set. A product page that invents
 * its own inventory is worth less than one that shows a short real list, so
 * these read the same public roster the /try preview does and link to the
 * actual profile.
 *
 * The endpoint returns only verified providers and no coordinates or contact
 * details — see app/api/public/route.ts for what is deliberately withheld.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Clock, MapPin, Stethoscope } from "lucide-react";
import type { PublicProvider } from "@/components/try/provider-preview";
import { NURSE_SERVICES } from "@/lib/nurse";
import { formatINR } from "@/lib/utils/format";

type Payload = {
  providers: PublicProvider[];
  total: number;
  availableNow: number;
};

const SERVICE_LABEL = new Map<string, string>(
  NURSE_SERVICES.map((s) => [s.id, s.short]),
);

function usePublicProviders(cadre: "doctor" | "nurse") {
  return useQuery<Payload>({
    // Same key shape as the /try preview so both surfaces share one cache
    // entry rather than each paying for the same request.
    queryKey: ["public-providers", cadre, false],
    queryFn: async () => {
      const res = await fetch(`/api/public?entity=providers&cadre=${cadre}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load providers right now.");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

/** Someone free right now is the better thing to show; fall back to the top of
 *  the list rather than rendering an empty slot. */
function pick(payload?: Payload) {
  const list = payload?.providers ?? [];
  return list.find((p) => p.available) ?? list[0];
}

/** Sign-in carries the provider, so the session lands on the person clicked. */
const profileHref = (id: string) =>
  `/login?next=${encodeURIComponent(`/patient/doctors/${id}`)}`;

export function LiveProviderCards() {
  const doctors = usePublicProviders("doctor");
  const nurses = usePublicProviders("nurse");

  const doctor = pick(doctors.data);
  const nurse = pick(nurses.data);
  const loading = doctors.isLoading || nurses.isLoading;

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton tone="nurse" />
      </div>
    );
  }

  // Nothing verified on the roster yet — point at the directory instead of
  // showing two empty frames.
  if (!doctor && !nurse) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          The directory is still being verified.
        </p>
        <Link
          href="/signup"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Create an account to be notified
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {doctor && <DoctorCard provider={doctor} />}
      {nurse && <NurseCard provider={nurse} />}
    </div>
  );
}

function DoctorCard({ provider }: { provider: PublicProvider }) {
  return (
    <Link
      href={profileHref(provider.id)}
      className="group block rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.5)]"
    >
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--accent)]">
          {provider.specialty || "General Consultation"}
        </span>
        <span className="font-mono font-bold text-[var(--text)]">
          {formatINR(provider.consultFee)}
        </span>
      </div>

      <h4 className="flex items-center gap-1.5 font-semibold text-lg text-[var(--text)]">
        <span className="truncate">{provider.fullName}</span>
        {provider.verified && (
          <BadgeCheck
            className="h-4 w-4 shrink-0 text-[var(--accent)]"
            aria-label="Verified by Doceeto"
          />
        )}
      </h4>

      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
        {provider.qualifications ||
          `${provider.experienceYears} yrs experience`}
      </p>

      <div className="pt-2 flex items-center justify-between">
        <span
          className={`text-[11px] font-semibold flex items-center gap-1 ${
            provider.available ? "text-status-ok" : "text-[var(--text-faint)]"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          {provider.available ? "Free to take a request now" : "Booking open"}
        </span>
        <span className="text-xs font-semibold text-[var(--accent)] underline group-hover:no-underline">
          View profile →
        </span>
      </div>
    </Link>
  );
}

function NurseCard({ provider }: { provider: PublicProvider }) {
  const services = provider.skills
    .map((s) => SERVICE_LABEL.get(s) ?? s)
    .slice(0, 3)
    .join(" · ");

  return (
    <Link
      href={profileHref(provider.id)}
      className="group block rounded-2xl border border-[#2F7BC4]/30 bg-[#2F7BC4]/5 p-5 space-y-3 transition-colors hover:border-[#2F7BC4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F7BC4]/50"
    >
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="font-semibold text-[#2F7BC4]">Home Nurse Visit</span>
        <span className="font-mono font-bold text-[var(--text)]">
          {formatINR(provider.homeVisitFee || provider.consultFee)}
        </span>
      </div>

      <h4 className="flex items-center gap-1.5 font-semibold text-lg text-[var(--text)]">
        <span className="truncate">{provider.fullName}</span>
        {provider.verified && (
          <BadgeCheck
            className="h-4 w-4 shrink-0 text-[#2F7BC4]"
            aria-label="Verified by Doceeto"
          />
        )}
      </h4>

      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
        <Stethoscope className="w-3.5 h-3.5 text-[#2F7BC4]" />
        {services || "Home care nurse"}
      </p>

      <div className="pt-2 flex items-center justify-between">
        <span
          className={`text-[11px] font-semibold flex items-center gap-1 ${
            provider.available ? "text-status-ok" : "text-[#2F7BC4]"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          {provider.available ? "Free to take a visit now" : "Verified home nurse"}
        </span>
        <span className="text-xs font-semibold text-[#2F7BC4] underline group-hover:no-underline">
          Book nurse →
        </span>
      </div>
    </Link>
  );
}

/** Same footprint as a real card, so the mock browser does not jump on load. */
function CardSkeleton({ tone }: { tone?: "nurse" }) {
  const isNurse = tone === "nurse";
  return (
    <div
      className={`animate-pulse rounded-2xl border p-5 space-y-3 ${
        isNurse
          ? "border-[#2F7BC4]/30 bg-[#2F7BC4]/5"
          : "border-[var(--border)] bg-[var(--bg)]"
      }`}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <span className="h-3 w-28 rounded bg-espresso-700" />
        <span className="h-3 w-12 rounded bg-espresso-700" />
      </div>
      <span className="block h-5 w-3/4 rounded bg-espresso-700" />
      <span className="block h-3 w-1/2 rounded bg-espresso-700" />
      <div className="flex items-center justify-between pt-2">
        <span className="h-3 w-32 rounded bg-espresso-700" />
        <span className="h-3 w-20 rounded bg-espresso-700" />
      </div>
    </div>
  );
}
