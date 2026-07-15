"use client";

import Link from "next/link";
import { Stethoscope, Pill, ChevronRight, MapPin } from "lucide-react";
import { SosTrigger } from "@/components/patient/sos-trigger";
import { CareStatus } from "@/components/patient/care-status";
import { HowItWorks } from "@/components/patient/how-it-works";
import { LiveTracking } from "@/components/patient/live-tracking";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";

export default function PatientHome() {
  const { patient } = useCurrentPatient();

  return (
    <div className="space-y-6">
      <div>
        <div className="font-jp text-sm text-salmon">癒し</div>
        <h1 className="mt-1 font-serif text-3xl text-cream">
          Hi, {patient.name.split(" ")[0]}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
          <MapPin className="h-3.5 w-3.5" /> {patient.address}
        </p>
      </div>

      {/* When a visit is live, tracking is the hero of the home screen. */}
      <LiveTracking patient={patient} />

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

      <SosTrigger patient={patient} />

      <HowItWorks />

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
        <span className="mt-0.5 block truncate text-xs text-[var(--text-faint)]">
          {sub}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta" />
    </Link>
  );
}
