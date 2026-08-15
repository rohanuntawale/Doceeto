"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Search, ArrowRight, BadgeCheck } from "lucide-react";
import type { ClinicPin } from "./clinic-map-impl";

/** WebGL needs `window`; lazy-loading also keeps MapLibre off first paint. */
const ClinicMap = dynamic(() => import("./clinic-map-impl"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[var(--surface)]">
      <span className="animate-pulse text-sm text-[var(--text-faint)]">
        Loading map…
      </span>
    </div>
  ),
});

interface PublicProvider {
  id: string;
  fullName: string;
  specialty: string;
  verified: boolean;
  clinicAddress?: string;
  clinicLat?: number;
  clinicLng?: number;
}

/**
 * "Doctors near you" — the landing page's map section.
 *
 * ── What it shows, and what it refuses to ──
 *
 * Name, specialty and clinic. Nothing else. Fees, ratings, availability and
 * photographs all exist on the provider record and all belong one click deeper
 * — a map is for answering "is there someone near me?", and a pin carrying six
 * facts answers it worse than a pin carrying one.
 *
 * The geography is CLINIC coordinates from /api/public, never the provider's
 * live position, which that endpoint deliberately withholds from anonymous
 * visitors. So this section can be public without publishing where a named
 * clinician is standing.
 *
 * Doctors without a verified clinic simply have no pin. That is correct rather
 * than unfortunate: an unchecked address on a public map is how a patient ends
 * up outside a door that is not a clinic.
 */
export function LandingClinicMap() {
  const [providers, setProviders] = useState<PublicProvider[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        // Location is optional on the public map. The clinic map still works
        // normally when permission is denied or unavailable.
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    );
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/public?entity=clinics")
      .then((r) => (r.ok ? r.json() : { clinics: [] }))
      .then((d) => alive && setProviders(d.clinics ?? []))
      .catch(() => alive && setProviders([]));
    return () => {
      alive = false;
    };
  }, []);

  /** Only doctors we can actually place on a map. */
  const clinics: ClinicPin[] = useMemo(() => {
    return (providers ?? [])
      .filter(
        (p): p is PublicProvider & { clinicLat: number; clinicLng: number } =>
          typeof p.clinicLat === "number" &&
          typeof p.clinicLng === "number" &&
          Boolean(p.clinicAddress),
      )
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        specialty: p.specialty,
        clinicAddress: p.clinicAddress!,
        lat: p.clinicLat,
        lng: p.clinicLng,
      }));
  }, [providers]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.specialty.toLowerCase().includes(q) ||
        c.clinicAddress.toLowerCase().includes(q),
    );
  }, [clinics, query]);

  return (
    <section id="clinics" className="relative bg-[var(--bg)] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="label">03 / Clinics near you</span>
          </div>
          <h2 className="mt-5 font-serif text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-[var(--text)]">
            Real doctors, <span className="italic text-[var(--accent)]">real addresses.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
            Every clinic below belongs to a doctor whose council registration we
            have checked. Find one near you, then book a visit, a home call or a
            video consult.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-card lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-0">
          {/* ── The list ── */}
          <div className="flex max-h-[520px] min-h-0 flex-col border-[var(--border)] lg:border-r">
            <div className="shrink-0 border-b border-[var(--border)] p-4">
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a name, specialty or area"
                  aria-label="Search clinics"
                  className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] pl-9 pr-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
                />
              </div>
              <p className="mt-2 px-1 text-xs text-[var(--text-faint)]">
                {providers === null
                  ? "Loading clinics…"
                  : `${shown.length} ${shown.length === 1 ? "clinic" : "clinics"} in Nagpur`}
              </p>
            </div>

            <ul className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto">
              {shown.map((c) => {
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                        active ? "bg-[var(--accent)]/[0.07]" : "hover:bg-[var(--bg)]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${
                          active
                            ? "bg-[var(--accent)] text-on-accent"
                            : "bg-[var(--bg)] text-[var(--text-faint)]"
                        }`}
                      >
                        <MapPin className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* Name and clinic. Nothing else — see the note above. */}
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-semibold text-[var(--text)]">
                            {c.fullName}
                          </span>
                          <BadgeCheck
                            aria-label="Verified"
                            className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
                          />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-faint)]">
                          {c.specialty}
                        </span>
                        <span className="mt-1 block truncate text-[13px] text-[var(--text-muted)]">
                          {c.clinicAddress}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}

              {providers !== null && shown.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  {clinics.length === 0
                    ? "No clinics published yet."
                    : `Nothing matches “${query}”.`}
                </li>
              )}
            </ul>

            <div className="shrink-0 border-t border-[var(--border)] p-3">
              <Link
                href="/try/doctors"
                className="group flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
              >
                See all doctors
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* ── The map ── */}
          <div className="min-h-[380px] lg:h-[520px]">
            <ClinicMap
              clinics={shown}
              selectedId={selectedId}
              onSelect={setSelectedId}
              userLocation={userLocation}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
