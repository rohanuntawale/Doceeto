"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Star,
  BadgeCheck,
  SlidersHorizontal,
  ChevronRight,
  X,
  LocateFixed,
  ArrowRight,
  Stethoscope,
} from "lucide-react";
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

// Bottom-sheet snap heights (share of the map container).
const SNAPS = ["24%", "54%", "88%"] as const;

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

  const initialSpecialty = params.get("specialty");
  const [filters, setFilters] = useState<Filters>(
    initialSpecialty ? { ...EMPTY_FILTERS, specialty: initialSpecialty } : EMPTY_FILTERS,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<0 | 1 | 2>(1);

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
  const selected = matched.find((d) => d.id === selectedId) ?? null;

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

  function selectDoctor(id: string) {
    setSelectedId(id);
    setSnap((s) => (s === 0 ? 1 : s)); // make sure the card is visible
  }

  const openProfile = (id: string) => router.push(`/patient/doctors/${id}`);

  // Draggable handle → snap up/down.
  const dragStart = useRef<number | null>(null);
  function onHandleDown(e: React.PointerEvent) {
    dragStart.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onHandleUp(e: React.PointerEvent) {
    if (dragStart.current === null) return;
    const dy = e.clientY - dragStart.current;
    dragStart.current = null;
    if (dy < -28) setSnap((s) => (Math.min(2, s + 1) as 0 | 1 | 2));
    else if (dy > 28) setSnap((s) => (Math.max(0, s - 1) as 0 | 1 | 2));
  }

  return (
    <div className="relative -mx-4 -mt-4 h-[calc(100dvh-8.5rem)] min-h-[460px] overflow-hidden sm:-mx-6 lg:rounded-3xl lg:border lg:border-[var(--border)]">
      {/* Map layer */}
      <div className="absolute inset-0">
        <DoctorMap
          fill
          patient={patient}
          doctors={onMap}
          selectedId={selectedId}
          onSelect={selectDoctor}
        />
      </div>

      {/* Top overlay — specialty context + filters */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="fh-card pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-sm">
          <Stethoscope className="h-4 w-4 text-primary" />
          <span className="font-medium text-cream">
            {filters.specialty !== "any" ? filters.specialty : "All doctors"}
          </span>
          <span className="text-[var(--text-faint)]">·</span>
          <span className="text-[var(--text-muted)]">{onMap.length} near you</span>
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className="fh-card pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-cream"
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Filters
          {activeFilterCount > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-accent">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Recenter (visual affordance) */}
      <button
        onClick={() => setSelectedId(null)}
        aria-label="Recenter"
        className="fh-card absolute right-3 grid h-11 w-11 place-items-center rounded-full text-primary transition-[bottom]"
        style={{ bottom: `calc(${SNAPS[snap]} + 0.75rem)` }}
      >
        <LocateFixed className="h-5 w-5" />
      </button>

      {/* Bottom sheet */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border-t border-[var(--border)] bg-[var(--glass-bg-strong)] shadow-soft-lg backdrop-blur-xl transition-[height] duration-300 ease-out"
        style={{ height: SNAPS[snap] }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={onHandleDown}
          onPointerUp={onHandleUp}
          onClick={() => setSnap((s) => ((s + 1) % 3) as 0 | 1 | 2)}
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-[var(--text-faint)]" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {selected ? (
            <DoctorDetail
              d={selected}
              patient={patient}
              onClose={() => setSelectedId(null)}
              onBook={() => openProfile(selected.id)}
            />
          ) : (
            <DoctorList
              doctors={matched}
              patient={patient}
              onSelect={selectDoctor}
              onOpen={openProfile}
            />
          )}
        </div>
      </div>

      {/* Filters overlay */}
      {showFilters && (
        <FilterSheet
          filters={filters}
          setFilters={setFilters}
          specialties={specialties}
          onClear={() => setFilters(EMPTY_FILTERS)}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  );
}

function DoctorList({
  doctors,
  patient,
  onSelect,
  onOpen,
}: {
  doctors: Doctor[];
  patient: { lat: number; lng: number };
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cream">Doctors near you</h2>
        <span className="text-xs text-[var(--text-faint)]">{doctors.length} available</span>
      </div>
      {doctors.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">
          No doctors match your filters.
        </p>
      ) : (
        <div className="space-y-2">
          {doctors.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              onDoubleClick={() => onOpen(d.id)}
              className="fh-tile flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:border-primary/40"
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white"
                style={{ background: d.avatarColor }}
              >
                {initials(d.fullName.replace("Dr. ", ""))}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-cream">{d.fullName}</p>
                  {d.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-status-ok" />}
                </div>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {d.specialty} · {doctorKind[d.kind].label}
                </p>
                <div className="mt-1 flex items-center gap-2.5 text-xs">
                  <span className="flex items-center gap-1 text-tan">
                    <Star className="h-3 w-3 fill-tan" />
                    {d.rating > 0 ? d.rating.toFixed(1) : "New"}
                  </span>
                  <span className="text-[var(--text-faint)]">
                    {formatKm(haversineKm(patient, d))} away
                  </span>
                  <span className="font-semibold text-cream">{formatINR(d.consultFee)}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DoctorDetail({
  d,
  patient,
  onClose,
  onBook,
}: {
  d: Doctor;
  patient: { lat: number; lng: number };
  onClose: () => void;
  onBook: () => void;
}) {
  const st = doctorStatus[d.status];
  return (
    <div className="animate-fade-up">
      <div className="mb-3 flex items-start gap-3">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-base font-semibold text-white"
          style={{ background: d.avatarColor }}
        >
          {initials(d.fullName.replace("Dr. ", ""))}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-lg font-semibold text-cream">{d.fullName}</h2>
            {d.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-status-ok" />}
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            {d.specialty} · {doctorKind[d.kind].label}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full fh-tile text-[var(--text-muted)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Rating" value={d.rating > 0 ? d.rating.toFixed(1) : "New"} icon={<Star className="h-3.5 w-3.5 fill-tan text-tan" />} />
        <Stat label="Away" value={formatKm(haversineKm(patient, d))} />
        <Stat label="Status" value={st.label} tone />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{doctorAbout(d)}</p>

      <div className="mt-3 flex items-center justify-between fh-tile rounded-2xl px-3.5 py-2.5">
        <span className="text-xs text-[var(--text-muted)]">Consult from</span>
        <span className="text-base font-semibold text-cream">{formatINR(d.consultFee)}</span>
      </div>

      <button
        onClick={onBook}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98]"
      >
        View profile & book <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: boolean;
}) {
  return (
    <div className="fh-tile rounded-2xl p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className={cn("mt-0.5 flex items-center justify-center gap-1 text-sm font-semibold", tone ? "text-primary" : "text-cream")}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function FilterSheet({
  filters,
  setFilters,
  specialties,
  onClear,
  onClose,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  specialties: string[];
  onClear: () => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  return (
    <div className="absolute inset-0 z-50">
      <button aria-hidden onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--glass-bg-strong)] p-5 shadow-soft-lg backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-cream">Filters</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full fh-tile text-[var(--text-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Row label="Speciality">
            <Chip active={filters.specialty === "any"} onClick={() => set({ specialty: "any" })}>Any</Chip>
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
            <Chip active={filters.kind === "practising"} onClick={() => set({ kind: "practising" })}>Practising</Chip>
            <Chip active={filters.kind === "resident"} onClick={() => set({ kind: "resident" })}>Junior</Chip>
          </Row>

          <Row label="Max consult fee">
            <Chip active={filters.maxPrice === null} onClick={() => set({ maxPrice: null })}>Any</Chip>
            {[400, 600, 800].map((p) => (
              <Chip key={p} active={filters.maxPrice === p} onClick={() => set({ maxPrice: p })}>≤ ₹{p}</Chip>
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
              Verified only
            </label>
            <button onClick={onClear} className="text-xs font-medium text-primary hover:underline">
              Clear all
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-on-accent"
        >
          Show doctors
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-[var(--border)] text-[var(--text-muted)] hover:border-primary/40 hover:text-cream",
      )}
    >
      {children}
    </button>
  );
}
