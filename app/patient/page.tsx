"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Stethoscope, Pill, ChevronRight, MapPin, Sparkles, ArrowRight } from "lucide-react";
import { CareStatus } from "@/components/patient/care-status";
import { PatientConsultTracker } from "@/components/consult/consult-tracker";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { analyzeSymptoms } from "@/lib/triage";

export default function PatientHome() {
  const { patient } = useCurrentPatient();
  const router = useRouter();
  const [symptoms, setSymptoms] = useState("");

  // Read the free-text symptoms → suggest a specialty (no diagnosis).
  const triage = useMemo(() => analyzeSymptoms(symptoms), [symptoms]);
  const specialty = triage?.specialties[0] ?? null;

  const seeDoctors = (spec?: string) =>
    router.push(spec ? `/patient/doctors?specialty=${encodeURIComponent(spec)}` : "/patient/doctors");

  return (
    <div className="space-y-6">
      {/* greeting */}
      <div>
        <h1 className="font-serif text-3xl text-cream">Hi, {patient.name.split(" ")[0]}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
          <MapPin className="h-3.5 w-3.5" /> {patient.address || "Set your location"}
        </p>
      </div>

      {/* Describe → suggest a doctor type → go to the map/list */}
      <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card">
        <div className="label mb-2">How are you feeling?</div>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          rows={2}
          placeholder="e.g. Fever and sore throat for 2 days"
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
        />

        {triage && specialty ? (
          <div className="mt-3 animate-fade-up rounded-lg border border-[var(--border)] bg-espresso p-3.5">
            <p className="flex items-center gap-2 text-sm font-medium text-cream">
              <Sparkles className="h-4 w-4 text-salmon" /> Based on what you described
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {triage.conditions.join(" · ")}.{" "}
              <span className="text-cream">
                A <b className="font-semibold text-salmon">{specialty}</b> is a good fit.
              </span>
            </p>
            <button
              onClick={() => seeDoctors(specialty)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta py-2.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
            >
              See {specialty} doctors <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-2 text-[10px] text-[var(--text-faint)]">
              A quick guide, not a diagnosis.
            </p>
          </div>
        ) : (
          <button
            onClick={() => seeDoctors()}
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-salmon transition-colors hover:text-cream"
          >
            Or browse all doctors <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Live tracking of a doctor who accepted (appears only when active) */}
      <PatientConsultTracker patient={patient} />

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <QuickLink
          href="/patient/doctors"
          kanji="医"
          title="Find a doctor"
          sub="Home, clinic or video"
          icon={<Stethoscope className="h-4 w-4" />}
        />
        <QuickLink
          href="/patient/medicine"
          kanji="薬"
          title="Order medicine"
          sub="Delivered to your door"
          icon={<Pill className="h-4 w-4" />}
        />
      </div>

      {/* Active care */}
      <div>
        <div className="label mb-3">Your care right now</div>
        <CareStatus patient={patient} />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  sub,
  kanji,
  icon,
}: {
  href: string;
  title: string;
  sub: string;
  kanji: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-card border border-[var(--border)] bg-espresso-800 p-4 shadow-card transition-colors hover:border-terracotta/40"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-terracotta/12 font-jp text-lg text-salmon">
        {kanji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-cream">
          {icon} {title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[var(--text-faint)]">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta" />
    </Link>
  );
}
