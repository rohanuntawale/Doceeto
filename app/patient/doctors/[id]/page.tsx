"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  BadgeCheck,
  Briefcase,
  Languages as LanguagesIcon,
  GraduationCap,
  Award,
  User as UserIcon,
  MapPin,
  ShieldCheck,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { BookingPanel } from "@/components/patient/booking-panel";
import { GigList } from "@/components/patient/gig-list";
import { useDoctors, useGigs, useReviews } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { useDoctorSchedule } from "@/lib/hooks/use-schedule";
import { doctorStatusOf, doctorKindOf } from "@/lib/labels";
import { initials, timeAgo } from "@/lib/utils/format";
import { haversineKm, formatKm } from "@/lib/utils/geo";
import { doctorQualification, doctorEducation, doctorAbout } from "@/lib/utils/doctor";
import { activeGigs } from "@/lib/gigs/rules";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function DoctorProfilePage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const router = useRouter();
  const doctors = useDoctors();
  const reviews = useReviews(id);
  const gigs = useGigs(id);
  const { patient } = useCurrentPatient();
  // One availability poll for the whole page — GigList and BookingPanel both
  // read from it rather than each fetching the same endpoint.
  const schedule = useDoctorSchedule(id);
  const [showBooking, setShowBooking] = useState(false);

  const doctor = doctors.find((d) => d.id === id);

  if (!doctor) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-10 text-center text-sm text-[var(--text-muted)]">
          Loading this doctor… if nothing appears, they may be off the network.
        </div>
      </div>
    );
  }

  const st = doctorStatusOf(doctor.status);
  // Only live listings reach a patient; the server filters too, but a doctor
  // browsing their own profile would otherwise see their paused rows here.
  const live = activeGigs(gigs);
  const firstName = doctor.fullName.replace("Dr. ", "").split(" ")[0];

  return (
    <div className="space-y-5">
      <BackLink />

      {/* ── Identity header ─────────────────────────────── */}
      <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card">
        <div className="flex items-start gap-4">
          <span
            className="grid h-16 w-16 shrink-0 place-items-center rounded-xl text-lg font-medium text-cream"
            style={{ background: doctor.avatarColor }}
          >
            {initials(doctor.fullName.replace("Dr. ", ""))}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate font-serif text-2xl text-cream">{doctor.fullName}</h1>
              {doctor.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-status-ok" />}
            </div>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {doctor.specialty} · {doctorKindOf(doctor.kind).label}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <span className="flex items-center gap-1 text-tan">
                <Star className="h-3.5 w-3.5 fill-tan" />
                {doctor.rating > 0 ? doctor.rating.toFixed(1) : "New"}
                <span className="text-[var(--text-faint)]">
                  ({reviews.length} review{reviews.length === 1 ? "" : "s"})
                </span>
              </span>
              <span className="flex items-center gap-1 text-[var(--text-faint)]">
                <MapPin className="h-3.5 w-3.5" />
                {formatKm(haversineKm(patient, doctor))} away
              </span>
              {/* Being on a gig is what actually decides availability, so it
                  outranks the self-reported online/offline status here. */}
              {schedule.onGig ? (
                <StatusPill tone="warn">On a gig</StatusPill>
              ) : (
                <StatusPill tone={st.tone}>{st.label}</StatusPill>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">{doctorAbout(doctor)}</p>

        {doctor.clinicAddress && (
          <p className="mt-3 flex items-start gap-1.5 border-t border-[var(--border)] pt-3 text-sm text-[var(--text-muted)]">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-salmon" />
            <span>
              <span className="text-[var(--text-faint)]">Clinic · </span>
              {doctor.clinicAddress}
            </span>
          </p>
        )}
      </div>

      {/* ── Quick facts ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact icon={<Briefcase className="h-4 w-4" />} label="Experience" value={`${doctor.experienceYears} yr${doctor.experienceYears === 1 ? "" : "s"}`} />
        <Fact icon={<UserIcon className="h-4 w-4" />} label="Doctor" value={doctor.gender === "male" ? "Male" : "Female"} />
        <Fact icon={<LanguagesIcon className="h-4 w-4" />} label="Speaks" value={doctor.languages.slice(0, 2).join(", ")} />
        <Fact icon={<ShieldCheck className="h-4 w-4" />} label="Reg. no." value={doctor.registrationNo || "On file"} />
      </div>

      {/* ── Credentials ─────────────────────────────────── */}
      <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card">
        <div className="label mb-3">Credentials</div>
        <div className="space-y-3">
          <CredRow icon={<Award className="h-4 w-4 text-salmon" />} title="Qualifications" body={doctorQualification(doctor)} />
          <CredRow icon={<GraduationCap className="h-4 w-4 text-salmon" />} title="Academic background" body={doctorEducation(doctor)} />
          <CredRow icon={<Briefcase className="h-4 w-4 text-salmon" />} title="Experience" body={`${doctor.experienceYears} years in ${doctor.specialty.toLowerCase()} — ${doctorKindOf(doctor.kind).label.toLowerCase()}.`} />
        </div>
      </div>

      {/* ── What they offer ─────────────────────────────────
          Gigs lead when the doctor publishes any: hiring a named package is
          the primary way to engage them. The slot picker stays available
          behind a disclosure, and takes over entirely when there are no gigs. */}
      {live.length > 0 ? (
        <>
          <div className="rounded-card border border-terracotta/30 bg-espresso-800 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="label">What {firstName} offers</div>
              {schedule.onGig && (
                <StatusPill tone="warn">On a gig</StatusPill>
              )}
            </div>
            <p className="mb-3 mt-1 text-xs text-[var(--text-faint)]">
              {schedule.onGig
                ? `${firstName} is finishing another gig — you can hire once they're free.`
                : "Pick a package and hire them directly."}
            </p>
            <GigList
              doctor={doctor}
              gigs={live}
              patient={patient}
              hireable={schedule.gigsHireable}
              lockedReason={
                schedule.onGig
                  ? `${firstName} is on a gig right now. Try again once they're free.`
                  : `${firstName} is with another patient right now.`
              }
              onHired={() => router.push("/patient")}
            />
          </div>

          {/* Appointments, demoted but not hidden. */}
          <div>
            <button
              type="button"
              onClick={() => setShowBooking((v) => !v)}
              className="flex w-full items-center justify-between rounded-card border border-[var(--border)] bg-espresso-800 px-5 py-4 text-left shadow-card transition-colors hover:border-terracotta/40"
            >
              <span className="flex items-center gap-2.5">
                <CalendarDays className="h-4 w-4 text-salmon" />
                <span className="text-sm font-medium text-cream">
                  Or book an appointment instead
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[var(--text-faint)] transition-transform ${showBooking ? "rotate-180" : ""}`}
              />
            </button>
            {showBooking && (
              <div className="mt-3">
                <BookingPanel
                  doctor={doctor}
                  patient={patient}
                  schedule={schedule}
                  onBooked={() => router.push("/patient")}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <BookingPanel
          doctor={doctor}
          patient={patient}
          schedule={schedule}
          onBooked={() => router.push("/patient")}
        />
      )}

      {/* ── Reviews ─────────────────────────────────────── */}
      <div>
        <div className="label mb-3">Patient reviews ({reviews.length})</div>
        {reviews.length === 0 ? (
          <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-6 text-center text-sm text-[var(--text-muted)]">
            No reviews yet — be the first after your consult.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <ReviewCard key={r.id} name={r.patientName} rating={r.rating} comment={r.comment} createdAt={r.createdAt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/patient/doctors"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-cream"
    >
      <ArrowLeft className="h-4 w-4" /> All doctors
    </Link>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-3 text-center shadow-card">
      <div className="flex items-center justify-center text-[var(--text-faint)]">{icon}</div>
      <div className="mt-1 truncate text-sm font-medium text-cream">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
    </div>
  );
}

function CredRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-terracotta/10">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-[var(--text-faint)]">{title}</div>
        <div className="text-sm text-cream">{body}</div>
      </div>
    </div>
  );
}

function ReviewCard({ name, rating, comment, createdAt }: { name: string; rating: number; comment: string; createdAt: string }) {
  const mounted = useMounted();
  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-cream">{name}</span>
        <span className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={i < rating ? "h-3.5 w-3.5 fill-tan text-tan" : "h-3.5 w-3.5 text-[var(--text-faint)]"}
            />
          ))}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-[var(--text-muted)]">{comment}</p>
      <p className="mt-1 font-mono text-[10px] text-[var(--text-faint)]">
        {mounted ? timeAgo(createdAt) : ""}
      </p>
    </div>
  );
}
