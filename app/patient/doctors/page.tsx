"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Star,
  BadgeCheck,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  X,
  LocateFixed,
  ArrowRight,
  Stethoscope,
  Search,
  Ear,
  Bone,
  Brain,
  MessageCircleHeart,
  Baby,
  Flower2,
  HeartPulse,
  Hand,
  LayoutGrid,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { DoctorMap } from "@/components/map/doctor-map";
import { useDoctors } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { doctorStatusOf, doctorKindOf } from "@/lib/labels";
import { formatINR, initials } from "@/lib/utils/format";
import { haversineKm, formatKm } from "@/lib/utils/geo";
import { doctorAbout } from "@/lib/utils/doctor";
import { cn } from "@/lib/utils/cn";
import { DoctorAvatar } from "@/components/ui/doctor-avatar";
import type { Doctor, DoctorKind, Gender } from "@/lib/types/domain";

type Filters = {
  specialty: string;
  maxPrice: number | null;
  minRating: number;
  kind: DoctorKind | "any";
  gender: Gender | "any";
  verifiedOnly: boolean;
  /** Only doctors publishing gigs you can hire outright. */
  gigsOnly: boolean;
  sort: "nearest" | "rating" | "price";
};

const EMPTY_FILTERS: Filters = {
  specialty: "any",
  maxPrice: null,
  minRating: 0,
  kind: "any",
  gender: "any",
  verifiedOnly: false,
  gigsOnly: false,
  sort: "nearest",
};

// Bottom-sheet snap heights (share of the map container).
const SNAPS = ["24%", "54%", "88%"] as const;

/** One glyph per bookable speciality, for the quick-pick row. */
const SPECIALTY_ICON: Record<string, LucideIcon> = {
  "General Physician": Stethoscope,
  Cardiologist: HeartPulse,
  Gynecologist: Flower2,
  Pediatrician: Baby,
  Orthopedic: Bone,
  Dermatologist: Hand,
  ENT: Ear,
  // The nerve doctor gets the organ itself. Psychiatry deliberately doesn't —
  // two brain glyphs side by side in the quick-pick row read as the same tile
  // twice, and a patient looking for help with their head isn't looking for an
  // anatomy diagram. The talking speciality gets a conversation instead.
  Neurologist: Brain,
  Psychiatrist: MessageCircleHeart,
};

/**
 * Plain-language tile labels. A quick-pick has room for one short word, and
 * "Skin" is what a patient is actually looking for — the clinical name still
 * shows on every doctor row and in the filter sheet.
 */
const SPECIALTY_SHORT: Record<string, string> = {
  "General Physician": "General",
  Cardiologist: "Heart",
  Gynecologist: "Women's",
  Pediatrician: "Child",
  Orthopedic: "Bones",
  Dermatologist: "Skin",
  ENT: "Ear/Nose",
  Psychiatrist: "Mind",
  Neurologist: "Brain",
};

/**
 * The number a patient actually compares on a row: the cheapest gig when the
 * doctor publishes any, otherwise the plain consult fee.
 */
function priceOf(d: Doctor) {
  return d.gigCount ? (d.gigFromPrice ?? d.consultFee) : d.consultFee;
}

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
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<0 | 1 | 2>(1);
  /** Desktop only — collapse the side panel for a full-width map. */
  const [panelOpen, setPanelOpen] = useState(true);

  const specialties = useMemo(
    () => Array.from(new Set(doctors.map((d) => d.specialty))).sort(),
    [doctors],
  );

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = doctors.filter((d) => {
      // Offline doctors are off the platform entirely. The live API already
      // withholds them; this keeps demo mode (and any carve-out rows a
      // patient's own history brings along) out of discovery too.
      if (d.status === "offline") return false;
      if (q && !`${d.fullName} ${d.specialty}`.toLowerCase().includes(q)) return false;
      if (filters.specialty !== "any" && d.specialty !== filters.specialty) return false;
      if (filters.maxPrice !== null && d.consultFee > filters.maxPrice) return false;
      if (d.rating < filters.minRating) return false;
      if (filters.kind !== "any" && d.kind !== filters.kind) return false;
      if (filters.gender !== "any" && d.gender !== filters.gender) return false;
      if (filters.verifiedOnly && !d.verified) return false;
      if (filters.gigsOnly && !d.gigCount) return false;
      return true;
    });
    out.sort((a, b) => {
      // A published gig is something a patient can hire outright, so it always
      // outranks a doctor who only takes appointment bookings. The chosen sort
      // then orders within each band rather than across them.
      const gigRank = Number(Boolean(b.gigCount)) - Number(Boolean(a.gigCount));
      if (gigRank !== 0) return gigRank;
      if (filters.sort === "rating") return b.rating - a.rating;
      if (filters.sort === "price") return priceOf(a) - priceOf(b);
      if ((a.status === "online") !== (b.status === "online"))
        return a.status === "online" ? -1 : 1;
      return haversineKm(patient, a) - haversineKm(patient, b);
    });
    return out;
  }, [doctors, filters, patient, query]);

  /** How many doctors sit behind each speciality chip (ignores the chip itself). */
  const specialtyCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of doctors) m[d.specialty] = (m[d.specialty] ?? 0) + 1;
    return m;
  }, [doctors]);

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
    if (filters.gigsOnly) n++;
    if (filters.sort !== "nearest") n++;
    return n;
  }, [filters]);

  function selectDoctor(id: string) {
    setSelectedId(id);
    setSnap((s) => (s === 0 ? 1 : s)); // make sure the card is visible
    setPanelOpen(true); // picking a pin while collapsed should reveal the card
  }

  const openProfile = (id: string) => router.push(`/patient/doctors/${id}`);

  // Search stays pinned at the top of the sheet; everything under it scrolls.
  const searchBar = (
    <div className="flex items-center gap-2">
      <div className="glass-inset flex flex-1 items-center gap-2.5 rounded-full px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          placeholder="Search doctors or specialities"
          aria-label="Search doctors or specialities"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-cream outline-none placeholder:text-[var(--text-faint)]"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--text-faint)]/25 text-cream"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <button
        onClick={() => setShowFilters(true)}
        aria-label="Filters"
        className="glass-control relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary"
      >
        <SlidersHorizontal className="h-[18px] w-[18px]" />
        {activeFilterCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-accent">
            {activeFilterCount}
          </span>
        )}
      </button>
    </div>
  );

  // One body, rendered by the mobile sheet and the desktop side panel.
  const panelBody = selected ? (
    <DoctorDetail
      d={selected}
      patient={patient}
      onClose={() => setSelectedId(null)}
      onBook={() => openProfile(selected.id)}
    />
  ) : (
    <>
      <SpecialityPicks
        specialties={specialties}
        counts={specialtyCounts}
        active={filters.specialty}
        onPick={(s) => setFilters((f) => ({ ...f, specialty: s }))}
      />
      <DoctorList
        doctors={matched}
        patient={patient}
        onSelect={selectDoctor}
        onOpen={openProfile}
        onClearFilters={() => {
          setFilters(EMPTY_FILTERS);
          setQuery("");
        }}
      />
    </>
  );

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
    <div className="map-chip-overlay relative -mx-4 -mt-4 -mb-[calc(var(--chrome-dock)+1.75rem)] h-[calc(100dvh-var(--chrome-top)-var(--chrome-dock))] min-h-[460px] overflow-hidden sm:-mx-6 lg:rounded-3xl lg:border lg:border-[var(--border)]">
      {/* Map layer. On desktop it stops where the side panel starts, so the
          panel sits beside the map rather than covering it. */}
      <div
        className={cn(
          "absolute inset-0 transition-[right] duration-300 ease-out",
          panelOpen && "lg:right-96",
        )}
      >
        <DoctorMap
          fill
          patient={patient}
          doctors={onMap}
          selectedId={selectedId}
          onSelect={selectDoctor}
        />
      </div>

      {/* Context chip — what the pins on the map currently represent. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 transition-[right] duration-300 ease-out",
          panelOpen && "lg:right-96",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/patient"))}
            aria-label="Go back"
            title="Go back"
            className="glass-control pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full text-cream transition-colors hover:bg-[rgb(var(--c-terracotta))]/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {/* min-w-0 + truncate: a long specialty ("General Physician") plus
              the count can outgrow a 320px phone; the name gives way and the
              count stays whole. */}
          <div className="glass-control pointer-events-auto flex min-w-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm">
            <Stethoscope className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 truncate font-medium text-cream">
              {filters.specialty !== "any" ? filters.specialty : "All doctors"}
            </span>
            <span className="text-[var(--text-faint)]">·</span>
            <span className="whitespace-nowrap text-[var(--text-muted)]">{onMap.length} near you</span>
          </div>
        </div>
      </div>

      {/* Floating control stack, Apple-Maps style: one pill, divided rows.
          Rides above the sheet on mobile; on desktop it tucks inside the
          map's right edge, clear of the panel. */}
      <div
        className={cn(
          "glass-control absolute bottom-[calc(var(--sheet-h)+0.75rem)] right-3 flex flex-col overflow-hidden rounded-2xl transition-[bottom,right] duration-300 lg:bottom-3",
          panelOpen ? "lg:right-[calc(24rem+0.75rem)]" : "lg:right-3",
        )}
        style={{ "--sheet-h": SNAPS[snap] } as React.CSSProperties}
      >
        <button
          onClick={() => setFilters(EMPTY_FILTERS)}
          aria-label="Show every speciality"
          title="Show every speciality"
          className="grid h-11 w-11 place-items-center text-primary transition-colors hover:bg-[rgb(var(--c-terracotta))]/10"
        >
          <LayoutGrid className="h-[18px] w-[18px]" />
        </button>
        <span className="h-px bg-[var(--glass-border)]" />
        <button
          onClick={() => setSelectedId(null)}
          aria-label="Recenter on you"
          title="Recenter on you"
          className="grid h-11 w-11 place-items-center text-primary transition-colors hover:bg-[rgb(var(--c-terracotta))]/10"
        >
          <LocateFixed className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Collapse handle — a tab on the panel's edge, so the map can be
          opened out to full width without losing the way back. */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        aria-expanded={panelOpen}
        aria-label={panelOpen ? "Hide the doctor list" : "Show the doctor list"}
        title={panelOpen ? "Hide list" : "Show list"}
        className={cn(
          "fh-card absolute top-1/2 hidden h-16 w-7 -translate-y-1/2 place-items-center rounded-l-xl rounded-r-none border-r-0 text-primary transition-[right] duration-300 ease-out hover:text-[rgb(var(--c-terracotta))] lg:grid",
          panelOpen ? "right-96" : "right-0",
        )}
      >
        {panelOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* Side panel (desktop) — same content as the sheet, docked right. */}
      <aside
        className={cn(
          "glass-sheet absolute inset-y-0 right-0 hidden w-96 flex-col border-l transition-transform duration-300 ease-out lg:flex lg:rounded-r-3xl",
          !panelOpen && "lg:translate-x-full",
        )}
        aria-hidden={!panelOpen}
      >
        <div className="shrink-0 px-4 pb-3 pt-4">{searchBar}</div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{panelBody}</div>
      </aside>

      {/* Bottom sheet (mobile) — a right-hand panel on a phone would cover
          the map entirely, so the drag-to-snap sheet stays there. */}
      <div
        className="glass-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-[1.75rem] border-t transition-[height] duration-300 ease-out lg:hidden"
        style={{ height: SNAPS[snap] }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={onHandleDown}
          onPointerUp={onHandleUp}
          onClick={() => setSnap((s) => ((s + 1) % 3) as 0 | 1 | 2)}
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-[var(--text-faint)]/50" />
        </div>

        <div className="shrink-0 px-4 pb-3 pt-1">{searchBar}</div>
        {/* Extra bottom room so the last row clears the floating nav bar. */}
        <div className="flex-1 overflow-y-auto px-4 pb-24">{panelBody}</div>
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

/**
 * Speciality quick-picks — the row that answers "who do I even need?" in one
 * tap, before the list is worth scrolling. Each tile carries how many doctors
 * sit behind it, so the choice is informed rather than a guess.
 */
function SpecialityPicks({
  specialties,
  counts,
  active,
  onPick,
}: {
  specialties: string[];
  counts: Record<string, number>;
  active: string;
  onPick: (specialty: string) => void;
}) {
  if (specialties.length === 0) return null;
  return (
    <section className="mb-4">
      <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">
        Specialities
      </h2>
      {/* Bleeds to the sheet's edge so a half-visible tile reads as "keep
          scrolling" rather than a clipped layout. */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PickTile
          icon={LayoutGrid}
          label="All"
          active={active === "any"}
          onClick={() => onPick("any")}
        />
        {specialties.map((s) => (
          <PickTile
            key={s}
            icon={SPECIALTY_ICON[s] ?? Stethoscope}
            label={SPECIALTY_SHORT[s] ?? s}
            hint={counts[s] ?? 0}
            active={active === s}
            onClick={() => onPick(active === s ? "any" : s)}
          />
        ))}
      </div>
    </section>
  );
}

function PickTile({
  icon: Icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** How many doctors sit behind this speciality; announced, not drawn. */
  hint?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={hint === undefined ? label : `${label}, ${hint} available`}
      className="flex w-[4.25rem] shrink-0 flex-col items-center gap-1.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]"
    >
      <span
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full transition-all",
          active
            ? "bg-primary text-on-accent shadow-[0_6px_18px_rgb(190_100_45/0.35)]"
            : "glass-inset text-primary hover:scale-[1.04]",
        )}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
      </span>
      <span
        className={cn(
          "w-full truncate text-center text-[11px] leading-tight",
          active ? "font-semibold text-primary" : "text-[var(--text-muted)]",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function DoctorList({
  doctors,
  patient,
  onSelect,
  onOpen,
  onClearFilters,
}: {
  doctors: Doctor[];
  patient: { lat: number; lng: number };
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onClearFilters: () => void;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">
          Doctors near you
        </h2>
        <span className="text-xs text-[var(--text-faint)]">{doctors.length} available</span>
      </div>
      {doctors.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No doctors match this search. Try a different name or speciality.
          </p>
          <button
            onClick={onClearFilters}
            className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-accent"
          >
            Clear search &amp; filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {doctors.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className="glass-inset flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:border-primary/40"
            >
              <DoctorAvatar
                doctor={d}
                className="h-11 w-11 rounded-xl text-sm font-semibold text-white"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-cream">{d.fullName}</p>
                  {d.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-status-ok" />}
                </div>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {d.specialty} · {doctorKindOf(d.kind).label}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                  <span className="flex items-center gap-1 text-tan">
                    <Star className="h-3 w-3 fill-tan" />
                    {d.rating > 0 ? d.rating.toFixed(1) : "New"}
                  </span>
                  <span className="text-[var(--text-faint)]">
                    {formatKm(haversineKm(patient, d))} away
                  </span>
                  {/* Gigs are the headline offering, so they replace the bare
                      consult fee whenever the doctor publishes any. */}
                  {d.gigCount ? (
                    <span className="flex items-center gap-1 font-semibold text-cream">
                      <Briefcase className="h-3 w-3 text-salmon" />
                      {d.gigCount} gig{d.gigCount === 1 ? "" : "s"}
                      {d.gigFromPrice != null && (
                        <span className="font-normal text-[var(--text-faint)]">
                          from {formatINR(d.gigFromPrice)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="font-semibold text-cream">{formatINR(d.consultFee)}</span>
                  )}
                  {d.onGig && (
                    <span className="rounded-full bg-status-warn/15 px-2 py-0.5 text-[10px] font-semibold text-tan">
                      On a gig
                    </span>
                  )}
                </div>
              </div>
              {/* Explicit way into the profile — double-tap isn't a mobile
                  gesture, so the chevron is a real control, not decoration. */}
              <span
                role="button"
                tabIndex={0}
                aria-label={`View ${d.fullName}'s profile`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(d.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen(d.id);
                  }
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
              >
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
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
  const st = doctorStatusOf(d.status);
  return (
    <div className="animate-fade-up">
      <div className="mb-3 flex items-start gap-3">
        <DoctorAvatar
          doctor={d}
          className="h-14 w-14 rounded-2xl text-base font-semibold text-white"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-lg font-semibold text-cream">{d.fullName}</h2>
            {d.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-status-ok" />}
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            {d.specialty} · {doctorKindOf(d.kind).label}
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
        {/* Being on a gig is what actually decides availability, so it
            outranks the self-reported online/offline status. */}
        <Stat label="Status" value={d.onGig ? "On a gig" : st.label} tone />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{doctorAbout(d)}</p>

      {/* What they're actually selling — gigs when they have them, the bare
          consult fee when they don't. */}
      <div className="mt-3 flex items-center justify-between fh-tile rounded-2xl px-3.5 py-2.5">
        {d.gigCount ? (
          <>
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Briefcase className="h-3.5 w-3.5 text-salmon" />
              {d.gigCount} gig{d.gigCount === 1 ? "" : "s"} to hire
            </span>
            <span className="text-base font-semibold text-cream">
              from {formatINR(d.gigFromPrice ?? d.consultFee)}
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-[var(--text-muted)]">Consult from</span>
            <span className="text-base font-semibold text-cream">
              {formatINR(d.consultFee)}
            </span>
          </>
        )}
      </div>

      <button
        onClick={onBook}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98]"
      >
        {d.gigCount ? "See gigs & hire" : "View profile & book"}{" "}
        <ArrowRight className="h-4 w-4" />
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
  // Portalled like every other dialog: rendered in place it sits inside
  // <main>'s z-10 stacking context, where the shell's scrim, tab pill and
  // dock all paint over it. (Only mounted after a user tap, so document
  // is always available.)
  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button aria-hidden onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--glass-bg-strong)] p-5 shadow-soft-lg backdrop-blur-xl">
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

          <label className="flex items-center gap-2 pt-1 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={filters.gigsOnly}
              onChange={(e) => set({ gigsOnly: e.target.checked })}
              className="h-4 w-4 accent-[color:var(--accent)]"
            />
            Offering gigs I can hire
          </label>

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
    </div>,
    document.body,
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
