"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  BadgeCheck,
  Video,
  Home,
  Building2,
  Zap,
  Map as MapIcon,
  List as ListIcon,
  SlidersHorizontal,
  ShieldQuestion,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { PatientBookings } from "@/components/patient/patient-bookings";
import { Triage, type TriageOutcome } from "@/components/patient/triage";
import { DoctorMap } from "@/components/map/doctor-map";
import { useDoctors, useActions } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { doctorStatus, doctorKind, acuity as acuityLabels } from "@/lib/labels";
import { formatINR, initials } from "@/lib/utils/format";
import { haversineKm, formatKm } from "@/lib/utils/geo";
import { doctorBlurb } from "@/lib/utils/doctor";
import { cn } from "@/lib/utils/cn";
import type { ConsultType, Doctor, DoctorKind, Gender } from "@/lib/types/domain";

const MODES: { type: ConsultType; label: string; icon: React.ReactNode; help: string }[] = [
  { type: "home_visit", label: "Home visit", icon: <Home className="h-4 w-4" />, help: "Doctor comes to you" },
  { type: "clinic", label: "Clinic visit", icon: <Building2 className="h-4 w-4" />, help: "You go to the doctor" },
  { type: "video", label: "Video call", icon: <Video className="h-4 w-4" />, help: "Talk from home" },
];

const DEFAULT_FEE: Record<ConsultType, number> = { home_visit: 900, clinic: 400, video: 400 };

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
  const doctors = useDoctors();
  const { patient } = useCurrentPatient();
  const { createRequest } = useActions();
  const toast = useToast();
  const router = useRouter();

  const [symptoms, setSymptoms] = useState("");
  const [mode, setMode] = useState<ConsultType>("home_visit");
  const [view, setView] = useState<"map" | "list">("map");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTriage, setShowTriage] = useState(false);
  const [triage, setTriage] = useState<TriageOutcome | null>(null);

  const feeFor = (d: Doctor, type: ConsultType) =>
    type === "home_visit" ? d.homeVisitFee : d.consultFee;

  const specialties = useMemo(
    () => Array.from(new Set(doctors.map((d) => d.specialty))).sort(),
    [doctors],
  );

  // Doctors that match the patient's filters, ranked by their choice.
  // Patients only ever see verified doctors.
  const matched = useMemo(() => {
    const out = doctors.filter((d) => {
      if (!d.verified) return false;
      if (filters.specialty !== "any" && d.specialty !== filters.specialty) return false;
      if (filters.maxPrice !== null && feeFor(d, mode) > filters.maxPrice) return false;
      if (d.rating < filters.minRating) return false;
      if (filters.kind !== "any" && d.kind !== filters.kind) return false;
      if (filters.gender !== "any" && d.gender !== filters.gender) return false;
      if (filters.verifiedOnly && !d.verified) return false;
      return true;
    });
    out.sort((a, b) => {
      if (filters.sort === "rating") return b.rating - a.rating;
      if (filters.sort === "price") return feeFor(a, mode) - feeFor(b, mode);
      // nearest: online first, then distance
      if ((a.status === "online") !== (b.status === "online"))
        return a.status === "online" ? -1 : 1;
      return haversineKm(patient, a) - haversineKm(patient, b);
    });
    return out;
  }, [doctors, filters, mode, patient]);

  // On the map we only place doctors who can actually take a request now.
  const onMap = useMemo(() => matched.filter((d) => d.status !== "offline"), [matched]);
  const onlineCount = onMap.filter((d) => d.status === "online").length;
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

  const indicativeFee = useMemo(() => {
    const pool = onMap.filter((d) => d.status === "online");
    if (pool.length === 0) return DEFAULT_FEE[mode];
    return Math.round(pool.reduce((a, d) => a + feeFor(d, mode), 0) / pool.length);
  }, [onMap, mode]);

  const addressFor = (type: ConsultType) =>
    type === "home_visit"
      ? patient.address
      : type === "clinic"
        ? "At the doctor's clinic"
        : "Video call";

  function requestNearby() {
    if (onlineCount === 0) {
      toast.push({
        tone: "info",
        title: "No doctors online for these filters",
        desc: "Try widening your filters, or pick a doctor from the list.",
      });
      return;
    }
    createRequest({
      patientId: patient.id,
      patientName: patient.name,
      type: mode,
      symptoms: symptoms.trim() || "General consultation.",
      acuity: triage?.acuity,
      triageSummary: triage?.summary ?? null,
      fee: indicativeFee,
      address: addressFor(mode),
      lat: patient.lat,
      lng: patient.lng,
      doctorId: null,
    });
    toast.push({
      tone: "success",
      title: "Sent to nearby doctors",
      desc: "The first doctor to accept will take your request.",
    });
    setSymptoms("");
  }

  function book(doctor: Doctor, type: ConsultType) {
    createRequest({
      patientId: patient.id,
      patientName: patient.name,
      type,
      symptoms: symptoms.trim() || "General consultation.",
      acuity: triage?.acuity,
      triageSummary: triage?.summary ?? null,
      fee: feeFor(doctor, type),
      address: addressFor(type),
      lat: patient.lat,
      lng: patient.lng,
      doctorId: doctor.id,
    });
    toast.push({
      tone: "success",
      title: "Request sent to " + doctor.fullName,
      desc: "You'll see it here the moment they accept.",
    });
    setSymptoms("");
  }

  function applyTriage(o: TriageOutcome) {
    setTriage(o);
    setMode(o.recommendedMode);
    if (!symptoms.trim()) setSymptoms(o.complaint);
    setShowTriage(false);
    toast.push({
      tone: "info",
      title: `Triage: ${acuityLabels[o.acuity].label}`,
      desc: o.advice,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="font-jp text-sm text-salmon">医 · DOCTORS</div>
        <h1 className="mt-1 font-serif text-3xl text-cream">Find a doctor</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          See doctors near you on the map. Pick one yourself, or let us find your
          best match.
        </p>
      </div>

      <PatientBookings patientId={patient.id} />

      {/* Quick check (triage) */}
      {showTriage ? (
        <Triage
          onApply={applyTriage}
          onEmergency={() => router.push("/patient")}
          onClose={() => setShowTriage(false)}
        />
      ) : triage ? (
        <div className="glass rounded-card flex items-center justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusPill tone={acuityLabels[triage.acuity].tone}>
                {acuityLabels[triage.acuity].label}
              </StatusPill>
              <span className="truncate text-xs text-[var(--text-muted)]">{triage.summary}</span>
            </div>
          </div>
          <button
            onClick={() => setShowTriage(true)}
            className="shrink-0 text-xs font-medium text-salmon hover:underline"
          >
            Redo
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTriage(true)}
          className="glass rounded-card flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:border-terracotta/40"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-terracotta/12 text-salmon ring-1 ring-inset ring-terracotta/20">
            <ShieldQuestion className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-cream">Not sure what you need?</span>
            <span className="block text-xs text-[var(--text-faint)]">
              Answer a few quick questions and we&apos;ll guide you.
            </span>
          </span>
        </button>
      )}

      <div>
        <label className="label">What&apos;s the problem? (optional)</label>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          rows={2}
          placeholder="e.g. Fever and sore throat for 2 days"
          className="mt-1.5 w-full resize-none rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
        />
      </div>

      {/* Care mode */}
      <div>
        <div className="label mb-2">How do you want to be seen?</div>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => {
            const active = mode === m.type;
            return (
              <button
                key={m.type}
                onClick={() => setMode(m.type)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors",
                  active
                    ? "border-terracotta bg-terracotta/10 text-cream"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-terracotta/40",
                )}
              >
                <span className={active ? "text-salmon" : ""}>{m.icon}</span>
                <span className="text-xs font-medium">{m.label}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{m.help}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Let us find the best match (broadcast) */}
      <div className="glass-strong rounded-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-cream">
              <Zap className="h-4 w-4 text-salmon" /> Let us find your best match
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {onlineCount} doctor{onlineCount === 1 ? "" : "s"} online near you.
              The first to accept takes it.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="metric text-lg text-cream">~{formatINR(indicativeFee)}</div>
            <div className="label">approx. fee</div>
          </div>
        </div>
        <Button className="mt-3 w-full" onClick={requestNearby}>
          Find my doctor now
        </Button>
      </div>

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
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[10px] font-medium text-cream">
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
          <DoctorMap
            patient={patient}
            doctors={onMap}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <p className="text-center text-xs text-[var(--text-faint)]">
            {onMap.length} doctor{onMap.length === 1 ? "" : "s"} match your filters.
            Tap a dot to see the doctor.
          </p>
          {selected ? (
            <DoctorProfile
              doctor={selected}
              patient={patient}
              onClose={() => setSelectedId(null)}
              onBook={book}
            />
          ) : (
            <p className="text-center text-sm text-[var(--text-muted)]">
              Tap a doctor on the map to see their profile.
            </p>
          )}
        </div>
      ) : matched.length === 0 ? (
        <EmptyState kanji="医" title="No doctors match your filters" />
      ) : (
        <div className="space-y-3">
          {matched.map((d) => (
            <DoctorCard key={d.id} d={d} patient={patient} onBook={book} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

      <Row label="Max fee">
        <Chip active={filters.maxPrice === null} onClick={() => set({ maxPrice: null })}>Any</Chip>
        {[500, 1000, 1500].map((p) => (
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function DoctorProfile({
  doctor,
  patient,
  onClose,
  onBook,
}: {
  doctor: Doctor;
  patient: { lat: number; lng: number };
  onClose: () => void;
  onBook: (d: Doctor, t: ConsultType) => void;
}) {
  const st = doctorStatus[doctor.status];
  const isOnline = doctor.status === "online";
  return (
    <div className="glass-strong animate-fade-up rounded-card p-4">
      <div className="flex items-start gap-3">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-base font-medium text-cream"
          style={{ background: doctor.avatarColor }}
        >
          {initials(doctor.fullName.replace("Dr. ", ""))}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-medium text-cream">{doctor.fullName}</p>
            {doctor.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-status-ok" />}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {doctor.specialty} · {doctorKind[doctor.kind].label}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1 text-tan">
              <Star className="h-3.5 w-3.5 fill-tan" /> {doctor.rating.toFixed(1)}
            </span>
            <span className="text-[var(--text-faint)]">
              {formatKm(haversineKm(patient, doctor))} away
            </span>
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1 text-[var(--text-faint)] hover:text-cream"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-sm text-[var(--text-muted)]">{doctorBlurb(doctor)}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button size="sm" disabled={!isOnline} onClick={() => onBook(doctor, "video")}>
          <Video className="h-3.5 w-3.5" /> {formatINR(doctor.consultFee)}
        </Button>
        <Button size="sm" variant="outline" disabled={!isOnline} onClick={() => onBook(doctor, "clinic")}>
          <Building2 className="h-3.5 w-3.5" /> {formatINR(doctor.consultFee)}
        </Button>
        <Button size="sm" variant="outline" disabled={!isOnline} onClick={() => onBook(doctor, "home_visit")}>
          <Home className="h-3.5 w-3.5" /> {formatINR(doctor.homeVisitFee)}
        </Button>
      </div>
      {!isOnline && (
        <p className="mt-2 text-center text-xs text-[var(--text-faint)]">
          This doctor is {st.label.toLowerCase()} right now.
        </p>
      )}
    </div>
  );
}

function DoctorCard({
  d,
  patient,
  onBook,
}: {
  d: Doctor;
  patient: { lat: number; lng: number };
  onBook: (d: Doctor, t: ConsultType) => void;
}) {
  const st = doctorStatus[d.status];
  const isOnline = d.status === "online";
  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-4 shadow-card">
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
          <div className="mt-1.5 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-tan">
              <Star className="h-3.5 w-3.5 fill-tan" /> {d.rating.toFixed(1)}
            </span>
            <span className="text-[var(--text-faint)]">
              {formatKm(haversineKm(patient, d))} away
            </span>
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-xs text-[var(--text-muted)]">{doctorBlurb(d)}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button size="sm" disabled={!isOnline} onClick={() => onBook(d, "video")}>
          <Video className="h-3.5 w-3.5" /> {formatINR(d.consultFee)}
        </Button>
        <Button size="sm" variant="outline" disabled={!isOnline} onClick={() => onBook(d, "clinic")}>
          <Building2 className="h-3.5 w-3.5" /> {formatINR(d.consultFee)}
        </Button>
        <Button size="sm" variant="outline" disabled={!isOnline} onClick={() => onBook(d, "home_visit")}>
          <Home className="h-3.5 w-3.5" /> {formatINR(d.homeVisitFee)}
        </Button>
      </div>
    </div>
  );
}
