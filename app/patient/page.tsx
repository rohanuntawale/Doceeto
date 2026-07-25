"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pill,
  ChevronRight,
  MapPin,
  Sparkles,
  ArrowRight,
  Video,
  Home as HomeIcon,
} from "lucide-react";
import { CareStatus } from "@/components/patient/care-status";
import { PatientConsultTracker } from "@/components/consult/consult-tracker";
import { GlassCard } from "@/components/ui/glass-card";
import { FaqCard, HistoryCard } from "@/components/dashboard/extras";
import { NewsCarousel } from "@/components/dashboard/news-carousel";
import { MapCard } from "@/components/dashboard/map-card";
import {
  ProgressRow,
  GaugeCard,
  ActivityCard,
  GoalsCard,
  TrendBadge,
} from "@/components/dashboard/cards";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { useMedicalHistory } from "@/lib/hooks/use-medical-history";
import { useT } from "@/lib/i18n";

export default function PatientHome() {
  const { patient } = useCurrentPatient();
  const { sessions } = useMedicalHistory();
  const { t } = useT();
  const router = useRouter();
  const [symptoms, setSymptoms] = useState("");

  const historyItems = sessions.slice(0, 4).map((s) => ({
    id: s.id,
    title: s.title,
    sub: s.conclusion ? `Suggested: ${s.conclusion.specialty}` : "Check in progress",
    color: "#7C8B5E",
  }));

  const located = Boolean(patient.address);
  const progressItems = [
    { label: "Profile", value: located ? 100 : 45 },
    { label: "Verified", value: 100, display: "Done" },
    { label: "Records", value: Math.min(100, sessions.length * 25), display: `${sessions.length}` },
    { label: "Care score", value: 78 },
  ];
  const activityData = [20, 45, 30, 65, 40, 85, 55];
  const goals = [
    { id: "profile", label: "Complete your profile", sub: "Add your details", done: located },
    { id: "contact", label: "Add an emergency contact", sub: "For faster SOS response" },
    { id: "checkup", label: "Book a yearly check-up", sub: "Stay ahead with preventive care" },
    { id: "meds", label: "Set medication reminders", sub: "Never miss a dose" },
    { id: "verify", label: "Verify your phone number" },
  ];

  const greetingKey =
    new Date().getHours() < 12
      ? "greeting.morning"
      : new Date().getHours() < 17
        ? "greeting.afternoon"
        : "greeting.evening";

  // "I need care" opens the guided Akinator-style checker (seed text passes through).
  const startCheck = () =>
    router.push(
      symptoms.trim()
        ? `/patient/care?q=${encodeURIComponent(symptoms.trim())}`
        : "/patient/care",
    );

  const firstName = patient.name.split(" ")[0] || "there";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      {/* Header — greeting + stat counters */}
      <header className="flex flex-wrap items-end justify-between gap-4 lg:col-span-12">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-cream lg:text-4xl">
            {t(greetingKey)},{" "}
            <span className="text-[rgb(var(--c-terracotta))]">{firstName}</span>
          </h1>
          <p className="mt-1.5 flex items-center gap-1 text-sm text-[var(--text-muted)]">
            <MapPin className="h-3.5 w-3.5" />
            {patient.address || t("home.setLocation")}
          </p>
        </div>
        <div className="flex items-end gap-6">
          <HeaderStat n={sessions.length} label="Checks" trend={12} />
          <HeaderStat n="1.2k+" label="Doctors" trend={8} />
          <HeaderStat n="24/7" label="Care" />
          <Link
            href="/patient/account"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-base font-semibold text-cream"
            aria-label={t("nav.account")}
          >
            {firstName.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Progress pills */}
      <div className="lg:col-span-12">
        <ProgressRow items={progressItems} />
      </div>

      {/* I need care — the hero action → guided checker */}
      <GlassCard className="p-5 lg:col-span-8 lg:p-6">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold text-cream">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          {t("home.needCare")}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("home.notWell")}</p>

        <div className="fh-tile mt-4 rounded-2xl p-1">
          <input
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startCheck()}
            placeholder={t("home.symptomPlaceholder")}
            className="w-full rounded-xl bg-transparent px-3 py-2.5 text-[15px] text-cream outline-none placeholder:text-[var(--text-faint)]"
          />
        </div>

        <button
          onClick={startCheck}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98]"
        >
          {t("home.findCare")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </GlassCard>

      {/* Live map with health metrics */}
      <div className="lg:col-span-4">
        <MapCard patient={patient} />
      </div>

      {/* Quick ways to get care */}
      <div className="grid grid-cols-3 gap-3 lg:col-span-12">
        <CareChip href="/patient/doctors" icon={<HomeIcon className="h-5 w-5" />} label={t("home.homeVisit")} color="#C0692F" />
        <CareChip href="/patient/doctors" icon={<Video className="h-5 w-5" />} label={t("home.videoCall")} color="#7C8B5E" />
        <CareChip href="/patient/medicine" icon={<Pill className="h-5 w-5" />} label={t("home.medicine")} color="#C99A4B" />
      </div>

      {/* Care activity + health score + goals */}
      <div className="lg:col-span-4">
        <ActivityCard title="Care activity" caption="Visits & checks this week" data={activityData} trend={18} />
      </div>
      <div className="lg:col-span-4">
        <GaugeCard title="Health score" value={78} caption="Looking good" trend={4} spark={[62, 64, 63, 68, 70, 74, 78]} />
      </div>
      <div className="lg:col-span-4">
        <GoalsCard title="Health goals" goals={goals} />
      </div>

      {/* Live tracking (only when active) */}
      <div className="lg:col-span-12">
        <PatientConsultTracker patient={patient} />
      </div>

      {/* Your care today */}
      <section className="lg:col-span-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-cream">{t("home.careToday")}</h3>
          <Link
            href="/patient/doctors"
            className="flex items-center gap-0.5 text-xs font-medium text-[rgb(var(--c-terracotta))]"
          >
            {t("home.seeAll")} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <CareStatus patient={patient} />
      </section>

      {/* Health history */}
      <div className="lg:col-span-6">
        <HistoryCard
          title="Your health history"
          items={historyItems}
          href="/patient/care"
          emptyText="Your symptom checks and visits will show here"
        />
      </div>

      {/* Latest news + FAQs */}
      <div className="lg:col-span-6">
        <NewsCarousel role="patient" />
      </div>
      <div className="lg:col-span-6">
        <FaqCard role="patient" />
      </div>
    </div>
  );
}

function HeaderStat({ n, label, trend }: { n: React.ReactNode; label: string; trend?: number }) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5">
        <p className="text-2xl font-bold leading-none text-cream lg:text-3xl">{n}</p>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
    </div>
  );
}

function CareChip({
  icon,
  label,
  href,
  onClick,
  color = "#0A84FF",
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  color?: string;
}) {
  const inner = (
    <span className="flex h-full flex-col items-center gap-2 rounded-2xl fh-card p-3.5 text-center transition-transform active:scale-[0.97]">
      <span
        className="grid h-11 w-11 place-items-center rounded-full"
        style={{ background: `${color}26`, color }}
      >
        {icon}
      </span>
      <span className="text-[13px] font-medium text-cream">{label}</span>
    </span>
  );
  return href ? (
    <Link href={href}>{inner}</Link>
  ) : (
    <button onClick={onClick} className="w-full">
      {inner}
    </button>
  );
}
