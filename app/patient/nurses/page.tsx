"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Languages,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NurseEngagePanel } from "@/components/patient/nurse-booking-panel";
import { useNurses } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { NURSE_ACCENT_VARS, NURSE_SERVICES, skillsOf, type NurseService } from "@/lib/nurse";
import { formatINR, initials } from "@/lib/utils/format";
import { haversineKm } from "@/lib/utils/geo";
import { cn } from "@/lib/utils/cn";
import type { Doctor } from "@/lib/types/domain";

/**
 * Home-care nurse search. The nurse equivalent of /patient/doctors, and
 * Nurses use the shared provider calendar for scheduled home visits, while
 * keeping the direct urgent-request path available.
 *
 * Every row is a real provider row from the database. Only VERIFIED nurses are
 * returned by the server (an unvetted person must never be dispatched to a
 * home), so there is no "verified only" filter to offer.
 */
export default function PatientNursesPage() {
  const nurses = useNurses();
  const { patient } = useCurrentPatient();
  const router = useRouter();
  const [service, setService] = useState<NurseService | null>(null);
  const [selectedNurse, setSelectedNurse] = useState<string | null>(null);

  // The symptom checker deep-links here with ?service=wound_dressing when a
  // complaint is nurse-scope. Read via window (not useSearchParams) so the
  // page needs no Suspense boundary.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("service");
    if (raw && NURSE_SERVICES.some((s) => s.id === raw)) setService(raw as NurseService);
  }, []);

  // Memoised so the sort below doesn't see a new object identity every render.
  const here = useMemo(
    () =>
      patient?.lat != null && patient?.lng != null
        ? { lat: patient.lat, lng: patient.lng }
        : null,
    [patient?.lat, patient?.lng],
  );

  const shown = useMemo(() => {
    const list = service
      ? nurses.filter((n) => skillsOf(n).includes(service))
      : nurses.slice();
    if (!here) return list;
    return list.sort(
      (a, b) => haversineKm(here, a) - haversineKm(here, b),
    );
  }, [nurses, service, here]);

  return (
    // Nurse surfaces run blue: the accent vars recolour every themed class
    // (chips, prices, CTAs) inside without per-element edits.
    <main style={NURSE_ACCENT_VARS} className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/patient"
        className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft className="mr-1 inline h-4 w-4" />
        Back to care
      </Link>

      <div className="mt-8">
        <p className="label">HOME CARE IN NAGPUR</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-cream">
          Find a verified nurse
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
          Practical support at home for recovery, elderly care, vitals and authorised
          procedures.
        </p>
      </div>

      {/* Service filter — the nurse equivalent of the doctor list's specialty
          filter, reading the same ids the nurse's profile stores. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {NURSE_SERVICES.map((s) => {
          const on = service === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setService(on ? null : s.id)}
              className={cn(
                "rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                on
                  ? "border-[rgb(var(--c-terracotta))] bg-[rgb(var(--c-terracotta))]/10 text-cream"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {s.short}
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        {shown.length === 0 ? (
          <Card>
            <div className="p-4">
              <EmptyState
                title="No nurses available yet"
                desc="No verified nurse is online in your area right now. Try again shortly, or book a doctor instead."
              />
            </div>
          </Card>
        ) : (
          shown.map((n) => {
            const km = here ? haversineKm(here, n) : null;
            return (
              <article
                key={n.id}
                className="rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full font-serif text-lg text-cream"
                      style={{ background: n.avatarColor }}
                    >
                      {n.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(n.fullName)
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-cream">
                          {n.fullName}
                        </h2>
                        {n.verified && (
                          <BadgeCheck
                            className="h-4 w-4 shrink-0 text-status-ok"
                            aria-label="Verified nurse"
                          />
                        )}
                      </div>
                      <p className="truncate text-sm text-[var(--text-muted)]">
                        {[n.qualifications, n.experienceYears ? `${n.experienceYears} years` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                        {km != null && (
                          <span>
                            <MapPin className="mr-1 inline h-3.5 w-3.5" />
                            {km.toFixed(1)} km
                          </span>
                        )}
                        {n.languages.length > 0 && (
                          <span>
                            <Languages className="mr-1 inline h-3.5 w-3.5" />
                            {n.languages.join(" · ")}
                          </span>
                        )}
                        {n.rating > 0 && (
                          <span>
                            <Star className="mr-1 inline h-3.5 w-3.5 text-tan" />
                            {n.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-[rgb(var(--c-terracotta))]">
                      {formatINR(n.homeVisitFee)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">home visit</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <div className="flex flex-wrap gap-2">
                    {skillsOf(n).map((id) => (
                      <span
                        key={id}
                        className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
                      >
                        {NURSE_SERVICES.find((s) => s.id === id)?.short}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedNurse(selectedNurse === n.id ? null : n.id)}
                    disabled={!patient}
                    className="rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-on-accent disabled:opacity-50"
                  >
                    {selectedNurse === n.id ? "Close booking" : "Book a visit"}
                  </button>
                </div>
                {selectedNurse === n.id && patient && here && (
                  <NurseEngagePanel
                    nurse={n}
                    patient={{ ...patient, lat: here.lat, lng: here.lng }}
                    onDone={() => router.push("/patient")}
                  />
                )}
              </article>
            );
          })
        )}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-card border border-[var(--border)] bg-espresso-800 p-4 text-sm text-[var(--text-muted)]">
        <ShieldCheck className="h-5 w-5 shrink-0 text-status-ok" />
        <p>
          Only nurses verified by Iyashi operations appear here. Nurses provide practical
          care within their scope and do not diagnose or prescribe.
        </p>
      </div>
    </main>
  );
}
