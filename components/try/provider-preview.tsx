"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, Star, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DoctorAvatar } from "@/components/ui/doctor-avatar";
import { NURSE_SERVICES } from "@/lib/nurse";
import { formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface PublicProvider {
  id: string;
  fullName: string;
  cadre: "doctor" | "nurse";
  specialty: string;
  skills: string[];
  qualifications: string;
  verified: boolean;
  rating: number;
  experienceYears: number;
  languages: string[];
  consultFee: number;
  homeVisitFee: number;
  avatarUrl?: string;
  avatarColor: string;
  available: boolean;
}

interface Payload {
  providers: PublicProvider[];
  total: number;
  availableNow: number;
}

const SERVICE_LABEL = new Map<string, string>(NURSE_SERVICES.map((s) => [s.id, s.short]));

/**
 * The roster, as an anonymous visitor sees it.
 *
 * Every card is a real registered provider, and the only thing missing versus
 * the signed-in list is the map and the button that books them. That split is
 * the whole design of the preview: the inventory is the proof, the booking is
 * the reason to sign up.
 *
 * Polls while the tab is open, because "available now" that is four minutes
 * stale is worse than not claiming it at all.
 */
export function ProviderPreview({
  cadre,
  urgentOnly = false,
  emptyTitle,
  emptyDesc,
}: {
  cadre: "doctor" | "nurse";
  urgentOnly?: boolean;
  emptyTitle: string;
  emptyDesc: string;
}) {
  const { data, isLoading, error } = useQuery<Payload>({
    queryKey: ["public-providers", cadre, urgentOnly],
    queryFn: async () => {
      const qs = new URLSearchParams({ entity: "providers", cadre });
      if (urgentOnly) qs.set("urgent", "1");
      const res = await fetch(`/api/public?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load providers right now.");
      return res.json();
    },
    refetchInterval: urgentOnly ? 15_000 : 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16 text-[var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Couldn't load the list"
        desc={(error as Error).message}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    );
  }

  const providers = data?.providers ?? [];

  if (!providers.length) {
    return (
      <EmptyState
        title={emptyTitle}
        desc={emptyDesc}
        action={
          <Link href="/signup">
            <Button>Create an account</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">
        {/* The denominator matters. A short list with no total reads as "this
            platform is empty" when it actually means "most of them are busy". */}
        {urgentOnly
          ? `${data?.availableNow ?? 0} free to take a request right now`
          : `${providers.length} verified ${cadre === "nurse" ? "nurses" : "doctors"}, ${data?.availableNow ?? 0} online now`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: PublicProvider }) {
  const isNurse = provider.cadre === "nurse";
  const services = provider.skills
    .map((s) => SERVICE_LABEL.get(s) ?? s)
    .slice(0, 3)
    .join(" · ");

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <DoctorAvatar
          doctor={provider}
          className="h-12 w-12 rounded-full text-sm font-semibold text-on-accent"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-[var(--text)]">
              {provider.fullName}
            </p>
            {provider.verified && (
              <BadgeCheck
                className={cn("h-4 w-4 shrink-0", isNurse ? "text-[#2F7BC4]" : "text-terracotta")}
                aria-label="Verified by Doceeto"
              />
            )}
          </div>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {isNurse ? services || "Home care nurse" : provider.specialty}
          </p>
          {provider.qualifications && (
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-faint)]">
              {provider.qualifications}
            </p>
          )}
        </div>

        {provider.available && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
              "bg-status-ok/15 text-status-ok",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
            Free now
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
        {provider.rating > 0 && (
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-tan text-tan" />
            {provider.rating.toFixed(1)}
          </span>
        )}
        {provider.experienceYears > 0 && <span>{provider.experienceYears} yrs experience</span>}
        {provider.languages.length > 0 && <span>{provider.languages.slice(0, 3).join(", ")}</span>}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            Home visit
          </p>
          <p className="text-sm font-semibold text-[var(--text)]">
            {formatINR(provider.homeVisitFee || provider.consultFee)}
          </p>
        </div>
        {/* Booking is the line. It goes to sign-in carrying this provider, so
            the account they create lands on the person they picked. */}
        <Link href={`/login?next=${encodeURIComponent(`/patient/doctors/${provider.id}`)}`}>
          <Button size="sm" variant={provider.available ? "primary" : "outline"}>
            {provider.available && <Zap className="h-3.5 w-3.5" />}
            Book
          </Button>
        </Link>
      </div>
    </Card>
  );
}
