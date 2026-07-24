"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Star,
  BadgeCheck,
  Map as MapIcon,
  List as ListIcon,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PatientBookings } from "@/components/patient/patient-bookings";
import { DoctorMap } from "@/components/map/doctor-map";
import { useDoctors } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { doctorStatus, doctorKind } from "@/lib/labels";
import { formatINR, initials } from "@/lib/utils/format";
import { haversineKm, formatKm } from "@/lib/utils/geo";
import { doctorAbout } from "@/lib/utils/doctor";
import { cn } from "@/lib/utils/cn";
import type { Doctor, DoctorKind, Gender } from "@/lib/types/domain";

type Filters = {
  specialty: string;
  maxPrice: number | null;
  minRating: number;
  kind: DoctorKind | "any";
  gender: Gender | "any";
  verifiedOnly: boolean;
  sort: "nearest" | "rating" | "price";
};

const EMPTY_FILTERS: Filters = {
  specialty: "any",
  maxPrice: null,
  minRating: 0,
  kind: "any",
  gender: "any",
  verifiedOnly: false,
  sort: "nearest",
};

export default function PatientDoctors() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <DoctorsBrowser />
    </Suspense>
  );
}

function DoctorsBrowser() {
  const doctors = useDoctors();
  const { patient } = useCurrentPatient();
  const router = useRouter();
  const params = useSearchParams();

  // A specialty passed from the home "describe → suggest" flow pre-filters.
  const initialSpecialty = params.get("specialty");
  const [view, setView] = useState<"map" | "list">("map");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(
    initialSpecialty ? { ...EMPTY_FILTERS, specialty: initialSpecialty } : EMPTY_FILTERS,
  );

  const specialties = useMemo(
    () => Array.from(new Set(doctors.map((d) => d.specialty))).sort(),
    [doctors],
  );

  const matched = useMemo(() => {
    const out = doctors.filter((d) => {
      if (filters.specialty !== "any" && d.specialty !== filters.specialty) return false;
      if (filters.maxPrice !== null && d.consultFee > filters.maxPrice) return false;
      if (d.rating < filters.minRating) return false;
      if (filters.kind !== "any" && d.kind !== filters.kind) return false;
      if (filters.gender !== "any" && d.gender !== filters.gender) return false;
      if (filters.verifiedOnly && !d.verified) return false;
      return true;
    });
    out.sort((a, b) => {
      if (filters.sort === "rating") return b.rating - a.rating;
      if (filters.sort === "price") return a.consultFee - b.consultFee;
      if ((a.status === "online") !== (b.status === "online"))
        return a.status === "online" ? -1 : 1;
      return haversineKm(patient, a) - haversineKm(patient, b);
    });
    return out;
  }, [doctors, filters, patient]);

  const onMap = useMemo(() => matched.filter((d) => d.status !== "offline"), [matched]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.specialty !== "any") n++;
    if (filters.maxPrice !== null) n++;
    if (filters.minRating > 0) n++;
    if (filters.kind !== "any") n++;
    if (filters.gender !== "any") n++;
    if (filters.verifiedOnly) n++;
    if (filters.sort !== "nearest") n++;
    return n;
  }, [filters]);

  const openProfile = (id: string) => router.push(`/patient/doctors/${id}`);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/patient"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="font-jp text-sm text-salmon">医 · DOCTORS</div>
        <h1 className="mt-1 font-serif text-3xl text-cream">Find a doctor</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {filters.specialty !== "any"
            ? `Showing ${filters.specialty}s near you. Tap a doctor for their full profile.`
            : "See doctors near you on the map or list. Tap one for their full profile."}
        </p>
      </div>

      <PatientBookings patientId={patient.id} />

      {/* View toggle + filters */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          <ToggleBtn active={view === "map"} onClick={() => setView("map")}>
            <MapIcon className="h-3.5 w-3.5" /> Map
          </ToggleBtn>
          <ToggleBtn active={view === "list"} onClick={() => setView("list")}>
            <ListIcon className="h-3.5 w-3.5" /> List
          </ToggleBtn>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            showFilters || activeFilterCount > 0
              ? "border-terracotta/50 text-salmon"
              : "border-[var(--border)] text-[var(--text-muted)] hover:text-cream",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          {activeFilterCount > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[10px] font-medium text-on-accent">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          specialties={specialties}
          onClear={() => setFilters(EMPTY_FILTERS)}
        />
      )}

      {/* Results */}
      {view === "map" ? (
        <div className="space-y-3">
          <DoctorMap patient={patient} doctors={onMap} selectedId={null} onSelect={openProfile} />
          <p className="text-center text-xs text-[var(--text-faint)]">
            {onMap.length} doctor{onMap.length === 1 ? "" : "s"} match your filters. Tap a dot to open their profile.
          </p>
        </div>
      ) : matched.length === 0 ? (
        <EmptyState kanji="医" title="No doctors match your filters" />
      ) : (
        <div className="space-y-3">
          {matched.map((d) => (
            <DoctorCard key={d.id} d={d} patient={patient} onOpen={() => openProfile(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-terracotta/15 text-salmon" : "text-[var(--text-muted)] hover:text-cream",
      )}
    >
      {children}
    </button>
  );
}

function DoctorCard({
  d,
  patient,
  onOpen,
}: {
  d: Doctor;
  patient: { lat: number; lng: number };
  onOpen: () => void;
}) {
  const st = doctorStatus[d.status];
  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-card border border-[var(--border)] bg-espresso-800 p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-terracotta/50"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-medium text-cream"
          style={{ background: d.avatarColor }}
        >
          {initials(d.fullName.replace("Dr. ", ""))}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-medium text-cream">{d.fullName}</p>
            {d.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-status-ok" />}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {d.specialty} · {doctorKind[d.kind].label}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1 text-tan">
              <Star className="h-3.5 w-3.5 fill-tan" /> {d.rating > 0 ? d.rating.toFixed(1) : "New"}
            </span>
            <span className="text-[var(--text-faint)]">{formatKm(haversineKm(patient, d))} away</span>
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta" />
      </div>

      <p className="mt-2.5 line-clamp-2 text-xs text-[var(--text-muted)]">{doctorAbout(d)}</p>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2.5">
        <span className="text-xs text-[var(--text-faint)]">
          Consult from <span className="font-semibold text-cream">{formatINR(d.consultFee)}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-terracotta">
          View profile <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

function FilterPanel({
  filters,
  setFilters,
  specialties,
  onClear,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  specialties: string[];
  onClear: () => void;
}) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  return (
    <div className="glass rounded-card space-y-3 p-4">
      <Row label="Speciality">
        <Chip active={filters.specialty === "any"} onClick={() => set({ specialty: "any" })}>
          Any
        </Chip>
        {specialties.map((s) => (
          <Chip key={s} active={filters.specialty === s} onClick={() => set({ specialty: s })}>
            {s}
          </Chip>
        ))}
      </Row>

      <Row label="Doctor">
        <Chip active={filters.gender === "any"} onClick={() => set({ gender: "any" })}>Any</Chip>
        <Chip active={filters.gender === "female"} onClick={() => set({ gender: "female" })}>Female</Chip>
        <Chip active={filters.gender === "male"} onClick={() => set({ gender: "male" })}>Male</Chip>
      </Row>

      <Row label="Type">
        <Chip active={filters.kind === "any"} onClick={() => set({ kind: "any" })}>Any</Chip>
        <Chip active={filters.kind === "practising"} onClick={() => set({ kind: "practising" })}>
          Practising
        </Chip>
        <Chip active={filters.kind === "resident"} onClick={() => set({ kind: "resident" })}>
          Junior
        </Chip>
      </Row>

      <Row label="Max consult fee">
        <Chip active={filters.maxPrice === null} onClick={() => set({ maxPrice: null })}>Any</Chip>
        {[400, 600, 800].map((p) => (
          <Chip key={p} active={filters.maxPrice === p} onClick={() => set({ maxPrice: p })}>
            ≤ ₹{p}
          </Chip>
        ))}
      </Row>

      <Row label="Rating">
        <Chip active={filters.minRating === 0} onClick={() => set({ minRating: 0 })}>Any</Chip>
        <Chip active={filters.minRating === 4} onClick={() => set({ minRating: 4 })}>4.0+</Chip>
        <Chip active={filters.minRating === 4.5} onClick={() => set({ minRating: 4.5 })}>4.5+</Chip>
      </Row>

      <Row label="Sort by">
        <Chip active={filters.sort === "nearest"} onClick={() => set({ sort: "nearest" })}>Nearest</Chip>
        <Chip active={filters.sort === "rating"} onClick={() => set({ sort: "rating" })}>Top rated</Chip>
        <Chip active={filters.sort === "price"} onClick={() => set({ sort: "price" })}>Cheapest</Chip>
      </Row>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={(e) => set({ verifiedOnly: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--accent)]"
          />
          Verified doctors only
        </label>
        <button onClick={onClear} className="text-xs text-salmon hover:underline">
          Clear all
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-terracotta bg-terracotta/15 text-salmon"
          : "border-[var(--border)] text-[var(--text-muted)] hover:border-terracotta/40 hover:text-cream",
      )}
    >
      {children}
    </button>
  );
}
