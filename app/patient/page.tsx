"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pill,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Video,
  Zap,
  Briefcase,
  HeartPulse,
  MessageCircle,
  ClipboardCheck,
  CalendarClock,
  BookOpenCheck,
} from "lucide-react";
import { CareStatus } from "@/components/patient/care-status";
import { LocationChip } from "@/components/patient/location-chip";
import { PatientConsultTracker } from "@/components/consult/consult-tracker";
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
import { useConsultRequests, useDoctors, useOrders, usePrescriptions } from "@/lib/hooks/data";
import { MEDICINE_ENABLED } from "@/lib/config";
import { weeklyCareActivity } from "@/lib/health/metrics";
import { realHealthScore } from "@/lib/health/score";
import { bmiBand, bmiOf, healthProfileCompletion } from "@/lib/health/profile";
import { BmiAdvisor } from "@/components/patient/bmi-advisor";
import { NurseCareSection } from "@/components/patient/nurse-care-section";
import { AvatarImage } from "@/components/ui/avatar-image";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n";

export default function PatientHome() {
  const { patient } = useCurrentPatient();
  const { sessions } = useMedicalHistory();
  const { t } = useT();
  const router = useRouter();
  const [symptoms, setSymptoms] = useState("");

  // Real care events, scoped to this patient — these drive the activity
  // bars and the health score below (no decorative numbers).
  const myRequests = useConsultRequests().filter((r) => r.patientId === patient.id);
  const myOrders = useOrders().filter((o) => o.patientId === patient.id);
  // Newest first from the server, so the first row is the current one.
  const latestRx = usePrescriptions().filter(
    (rx) => !rx.patientId || rx.patientId === patient.id,
  )[0];
  const nextVisit = myRequests
    .filter((r) => r.scheduledAt && Date.parse(r.scheduledAt) >= Date.now() && r.status !== "cancelled")
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))[0];

  // Header stats, all live: the same doctors list the map renders (so the
  // count agrees with what the patient can actually reach), and the checks
  // trend measured the same way as the activity card — this week vs last.
  const doctors = useDoctors();
  const doctorsOnline = doctors.filter((d) => d.status === "online").length;
  // The checker saves drafts after every answer so a patient can resume. A
  // dashboard count must represent completed checks only, not those drafts.
  const completedChecks = sessions.filter((s) => Boolean(s.conclusion));
  const checksTrend = weeklyCareActivity(completedChecks.map((s) => s.startedAt)).trend;

  const historyItems = sessions.slice(0, 4).map((s) => ({
    id: s.id,
    title: s.title,
    sub: s.conclusion ? t("home.suggested", { x: s.conclusion.specialty }) : t("home.checkInProgress"),
    color: "#7C8B5E",
  }));

  const located = Boolean(patient.located);

  // "Care activity": every real care event this week — symptom checks run,
  // consults booked, medicine ordered — bucketed per day, with the trend
  // measured against last week.
  const activity = weeklyCareActivity([
    ...completedChecks.map((s) => s.startedAt),
    ...myRequests.map((r) => Date.parse(r.createdAt)),
    ...myOrders.map((o) => Date.parse(o.createdAt)),
  ]);

  // BMI from the health profile — feeds the score and the advisor below.
  const bmi = bmiOf(patient.healthProfile ?? {});

  // The REAL health score (lib/health/score.ts): body, lifestyle and risk
  // factors from the health profile, plus the last 90 days of actual care
  // history — emergencies taken, appointments missed, urgent symptom checks.
  // Null until the profile can support a number; the gauge then invites them
  // to fill it in rather than inventing one.
  const nowMs = Date.now();
  const score = realHealthScore({
    profile: patient.healthProfile ?? {},
    emergencyConsultTimes: myRequests
      .filter((r) => r.mode === "emergency")
      .map((r) => Date.parse(r.createdAt)),
    // A booked slot in the past that was never completed or called off is a
    // missed visit — the one adherence fact the data can actually prove.
    missedAppointmentTimes: myRequests
      .filter(
        (r) =>
          r.scheduledAt &&
          Date.parse(r.scheduledAt) < nowMs &&
          (r.status === "pending" || r.status === "accepted"),
      )
      .map((r) => Date.parse(r.scheduledAt!)),
    checkConclusions: sessions
      .filter((s) => s.conclusion)
      .map((s) => ({ at: s.startedAt, urgency: s.conclusion!.urgency })),
  });

  // BMI replaces the old decorative "Verified: Done" pill — a real number,
  // full when in the healthy range, visibly short when out of it or missing.
  const progressItems = [
    // Reads the same completion the account page shows, so the two agree.
    // It was previously a flat 100 whenever a location existed, which claimed
    // a finished profile for patients who had filled in almost nothing.
    { label: t("home.profile"), value: healthProfileCompletion(patient.healthProfile) },
    {
      label: t("health.bmi"),
      value: bmi === undefined ? 0 : bmiBand(bmi) === "healthy" ? 100 : 45,
      display: bmi === undefined ? t("home.add") : `${bmi}`,
    },
    { label: t("home.records"), value: Math.min(100, completedChecks.length * 25), display: `${completedChecks.length}` },
    { label: t("health.score"), value: score?.value ?? 0, display: score ? undefined : ", " },
  ];
  const goals = [
    { id: "profile", label: t("goal.profile"), sub: t("goal.profileSub"), done: located, href: "/patient/account" },
    { id: "contact", label: t("goal.contact"), sub: t("goal.contactSub"), href: "/patient/account" },
    { id: "checkup", label: t("goal.checkup"), sub: t("goal.checkupSub"), href: "/patient/doctors" },
    ...(MEDICINE_ENABLED
      ? [{ id: "meds", label: t("goal.meds"), sub: t("goal.medsSub"), href: "/patient/medicine" }]
      : []),
    { id: "verify", label: t("goal.verify"), href: "/patient/account" },
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
      {/* Watches BMI and raises the AI suggestion notification. Renders nothing. */}
      <BmiAdvisor />

      {/* Header, greeting + stat counters */}
      <header className="flex flex-wrap items-end justify-between gap-5 lg:col-span-12">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            {t("home.dashboard")}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.05em] text-cream lg:text-[2.8rem]">
            {t(greetingKey)},{" "}
            <span className="text-[rgb(var(--c-terracotta))]">{firstName}</span>
          </h1>
          <LocationChip />
        </div>
        {/* Full-width row below sm so the stats and avatar share one line
            instead of the avatar wrapping onto its own. */}
        <div className="flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-2 sm:w-auto sm:justify-start sm:gap-6">
          {/* Live numbers, not decoration: checks are this patient's own
              symptom checks (trend = this week vs last, shown only once there
              is one to compare); doctors is the platform roster with how many
              are online right now. "24/7" stays, a promise, not a metric. */}
          <HeaderStat
            n={completedChecks.length}
            label={t("home.checks")}
            trend={checksTrend ?? undefined}
          />
          <HeaderStat
            n={formatCount(doctors.length)}
            label={t("home.doctors")}
            badge={
              doctorsOnline > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--c-status-ok))]/15 px-2 py-0.5 text-[11px] font-bold text-[rgb(var(--c-status-ok))]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--c-status-ok))] animate-pulse" />
                  {t("home.online", { n: String(doctorsOnline) })}
                </span>
              ) : undefined
            }
          />
          <HeaderStat n="24/7" label={t("home.care247")} />
          {/* The avatar IS the door to their profile, dressed like one:
              brand-coloured, ringed, labelled. A photo replaces the initial
              once they add one on the account page. */}
          <Link
            href="/patient/account"
            className="group flex shrink-0 flex-col items-center gap-1"
            aria-label={t("nav.account")}
            title="My profile"
          >
            <AvatarImage
              src={patient.avatarUrl}
              fallback={firstName.charAt(0).toUpperCase()}
              background="linear-gradient(135deg, rgb(var(--c-terracotta)), rgb(var(--c-salmon)))"
              className="h-11 w-11 rounded-full text-base font-semibold text-on-accent ring-2 ring-terracotta/40 ring-offset-2 ring-offset-transparent transition-transform group-hover:scale-105"
            />
            <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] transition-colors group-hover:text-cream">
              {t("home.profile")}
            </span>
          </Link>
        </div>
      </header>

      {/* Progress pills */}
      <div className="lg:col-span-12 rounded-2xl bg-white/45 p-2 shadow-[0_10px_30px_rgb(16_45_35/0.04)]">
        <ProgressRow items={progressItems} />
      </div>

      {/* I need care, the hero action → guided checker */}
      <section className="relative min-h-[330px] overflow-hidden rounded-[2rem] border border-[rgb(var(--c-forest))/0.08] bg-[linear-gradient(135deg,rgb(255_255_255)_0%,rgb(var(--c-forest-mint))/0.18_58%,rgb(var(--c-terracotta-300))/0.48_100%)] p-6 text-[rgb(var(--c-forest))] shadow-[0_22px_50px_rgb(21_61_50/0.12)] lg:col-span-8 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-[rgb(var(--c-forest))/0.08]" />
        <div className="pointer-events-none absolute bottom-[-5rem] right-20 h-52 w-52 rounded-full bg-[rgb(var(--c-forest-mint))/0.22] blur-2xl" />
        <div className="relative flex h-full flex-col justify-between gap-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--c-forest))/0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[rgb(var(--c-terracotta))]">
                <Sparkles className="h-3.5 w-3.5" /> Your care space
              </p>
              <h2 className="max-w-[24rem] text-3xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-4xl">
                {t("home.needCare")}<br /><span className="text-[rgb(var(--c-terracotta))]">starts here.</span>
              </h2>
              <p className="mt-3 max-w-[25rem] text-sm leading-relaxed text-[rgb(var(--c-forest))/0.68]">{t("home.notWell")} Tell us what you feel and we&apos;ll help you choose your next best step.</p>
            </div>
            <span className="hidden h-14 w-14 shrink-0 rotate-6 place-items-center rounded-2xl bg-white/70 text-[rgb(var(--c-terracotta))] shadow-sm sm:grid">
              <MessageCircle className="h-7 w-7" />
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
            <div className="rounded-2xl border border-white/70 bg-white/75 p-1.5 shadow-sm backdrop-blur-md">
              <input
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startCheck()}
                placeholder={t("home.symptomPlaceholder")}
                className="w-full rounded-xl bg-transparent px-3 py-3 text-[15px] text-[rgb(var(--c-forest))] outline-none placeholder:text-[rgb(var(--c-forest))/0.48]"
              />
            </div>
            <button
              onClick={startCheck}
              className="group flex items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--c-terracotta))] px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {t("home.findCare")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* Live map with health metrics */}
      <div className="lg:col-span-4">
        <MapCard patient={patient} />
      </div>

      {/* The ways to get care. "Care now" broadcasts to whoever is free;
          "Find a doctor" is where gigs and slots are picked; "Nurse at home"
          is the home-care cadre, which is a different job from a consult
          dressings, injections, elderly care, so it gets its own door. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-12">
        <CareChip href="/patient/now" icon={<Zap className="h-5 w-5" />} label="Care now" sub="Fast help" color="#C96C32" />
        <CareChip href="/patient/doctors" icon={<Briefcase className="h-5 w-5" />} label="Find a doctor" sub="Browse experts" color="#7C8B5E" />
        <CareChip href="/patient/doctors?cadre=nurse" icon={<HeartPulse className="h-5 w-5" />} label="Nurse at home" sub="Care at your door" color="#3E826E" />
        <CareChip href="/patient/doctors" icon={<Video className="h-5 w-5" />} label={t("home.videoCall")} sub="Talk face to face" color="#5E7C8B" />
        {MEDICINE_ENABLED && (
          <CareChip href="/patient/medicine" icon={<Pill className="h-5 w-5" />} label={t("home.medicine")} sub="Keep on track" color="#C99A4B" />
        )}
      </div>

      <NurseCareSection patient={patient} />

      {/* A lower-level snapshot that turns the patient's existing records into
          clear next actions. Every card is either backed by a real record or
          points to the place where the patient can create one. */}
      <section className="lg:col-span-12">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="label text-[rgb(var(--c-terracotta))]">Your care, in motion</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-cream sm:text-2xl">A little more care context</h2>
          </div>
          <span className="hidden text-xs text-[var(--text-muted)] sm:block">Small steps add up.</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <SnapshotCard
            href="/patient/care?history=1"
            icon={<ClipboardCheck className="h-5 w-5" />}
            eyebrow="Latest check"
            title={completedChecks[0]?.title ?? "Your next check-in"}
            detail={completedChecks[0]?.conclusion
              ? `Suggested: ${completedChecks[0].conclusion.specialty}`
              : "Share how you are feeling to get a guided care path."}
            action={completedChecks[0] ? "Review result" : "Start a check"}
            color="#C0692F"
          />
          <SnapshotCard
            href={nextVisit ? "/patient/doctors" : "/patient/doctors"}
            icon={<CalendarClock className="h-5 w-5" />}
            eyebrow="Next on your calendar"
            title={nextVisit?.scheduledAt ? formatVisitDate(nextVisit.scheduledAt) : "No visit booked"}
            detail={nextVisit
              ? `Your ${nextVisit.targetCadre === "nurse" ? "nurse visit" : "care visit"} is coming up.`
              : "Find a doctor or book a nurse visit when you are ready."}
            action={nextVisit ? "View care" : "Book a visit"}
            color="#3E826E"
          />
          <SnapshotCard
            href={latestRx ? `/patient/prescriptions/${latestRx.id}` : "/patient/doctors"}
            icon={<BookOpenCheck className="h-5 w-5" />}
            eyebrow="Treatment shelf"
            title={latestRx?.items.length ? latestRx.items[0].name : "Nothing saved yet"}
            detail={latestRx
              ? latestRx.items.length > 1 ? `+${latestRx.items.length - 1} more from ${latestRx.doctorName}` : `From ${latestRx.doctorName}`
              : "Your prescriptions and care notes will collect here."}
            action={latestRx ? "Open prescription" : "Talk to a doctor"}
            color="#7C6FB2"
          />
        </div>
      </section>

      {/* Care activity + health score + goals */}
      <div className="lg:col-span-4">
        <ActivityCard
          title={t("home.careActivity")}
          caption="Visits & checks this week"
          data={activity.data}
          // null = nothing to compare against; the badge hides rather than
          // asserting a measured 0%.
          trend={activity.trend ?? undefined}
        />
      </div>
      <div className="lg:col-span-4">
        {score ? (
          <GaugeCard
            title={t("health.score")}
            value={score.value}
            caption={score.caption}
            trend={score.trend !== 0 ? score.trend : undefined}
            spark={score.spark}
            footer={
              <div className="space-y-2.5">
                {/* BMI in the health card itself, the number patients look
                    for, with the band that decides whether it's a concern. */}
                <Link
                  href="/patient/account"
                  className={cn(
                    "flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs transition-opacity hover:opacity-80",
                    bmi === undefined
                      ? "bg-white/5 text-[var(--text-muted)]"
                      : bmiBand(bmi) === "healthy"
                        ? "bg-[rgb(var(--c-status-ok))]/12 text-[rgb(var(--c-status-ok))]"
                        : "bg-tan/12 text-tan",
                  )}
                >
                  <span className="font-semibold">
                    {t("health.bmi")} {bmi !== undefined ? bmi : ", "}
                  </span>
                  <span>
                    {bmi !== undefined
                      ? t(`bmi.${bmiBand(bmi)}`)
                      : t("health.addHeightWeight")}
                  </span>
                </Link>
                {score.pillars.map((pl) => (
                  <div key={pl.key} className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_32px] items-center gap-2 sm:grid-cols-[minmax(82px,0.8fr)_minmax(70px,1fr)_36px]" title={pl.note}>
                    <span className="min-w-0 truncate text-[11px] text-[var(--text-muted)]">
                      {pl.label}
                    </span>
                    <span className="h-1.5 min-w-0 overflow-hidden rounded-full bg-[rgb(var(--c-espresso-700))]">
                      <span
                        className="block h-full rounded-full bg-[rgb(var(--c-terracotta))]"
                        style={{ width: `${(pl.earned / pl.max) * 100}%` }}
                      />
                    </span>
                    <span className="text-right text-[11px] font-semibold text-cream">
                      {pl.earned}/{pl.max}
                    </span>
                  </div>
                ))}
                {score.coverage.known < score.coverage.total && (
                  <Link
                    href="/patient/account"
                    className="block pt-0.5 text-[11px] leading-snug text-salmon transition-colors hover:text-cream"
                  >
                    {t("health.basedOn", { a: String(score.coverage.known), b: String(score.coverage.total) })}
                  </Link>
                )}
              </div>
            }
          />
        ) : (
          // No number is the honest answer until the profile can support one.
          <section className="fh-card relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl p-6 text-center">
            <div className="pattern-grid pointer-events-none absolute inset-0" aria-hidden />
            <p className="relative text-sm font-semibold text-cream">{t("health.noScoreTitle")}</p>
            <p className="relative mt-2 max-w-[220px] text-xs leading-relaxed text-[var(--text-muted)]">
              {t("health.noScoreDesc")}
            </p>
            <Link
              href="/patient/account"
              className="relative mt-4 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-accent transition-transform active:scale-[0.98]"
            >
              {t("health.addDetails")}
            </Link>
          </section>
        )}
      </div>
      <div className="lg:col-span-4">
        <GoalsCard title={t("home.healthGoals")} goals={goals} />
      </div>

      {/* Live tracking (only when active) */}
      <div className="lg:col-span-12">
        <PatientConsultTracker patient={patient} />
      </div>

      {/* The latest prescription. Only once there IS one, an empty card
          promising future documents would be furniture. The newest is on the
          dashboard because "what am I meant to be taking?" is a question
          people come back to the app to answer, not one they browse a list
          for. */}
      {latestRx && (
        <section className="lg:col-span-12">
          <Link
            href={`/patient/prescriptions/${latestRx.id}`}
            className="group flex items-center gap-3.5 rounded-3xl border border-terracotta/30 bg-terracotta/[0.07] p-4 transition-colors hover:bg-terracotta/[0.12] sm:p-5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-terracotta/15 font-serif text-xl text-terracotta">
              ℞
            </span>
            <span className="min-w-0 flex-1">
              <span className="label block text-terracotta">{t("rx.latest")}</span>
              <span className="mt-0.5 block truncate text-sm font-semibold text-cream">
                {latestRx.items.length > 0
                  ? latestRx.items.map((it) => it.name).join(" · ")
                  : latestRx.diagnosis || t("rx.consultationRecord")}
              </span>
              <span className="block truncate text-xs text-[var(--text-muted)]">
                {latestRx.doctorName}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-terracotta transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>
      )}

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
        {/* Dashboard shows only the top few, full list lives behind "See all". */}
        <CareStatus patient={patient} limit={3} moreHref="/patient/doctors" />
      </section>

      {/* Health history */}
      <div className="lg:col-span-6">
        <HistoryCard
          title="Your health history"
          items={historyItems}
          href="/patient/care?history=1"
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

/** "1.2k" once a count outgrows four digits; the plain number until then. */
function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

function HeaderStat({
  n,
  label,
  trend,
  badge,
}: {
  n: React.ReactNode;
  label: string;
  trend?: number;
  /** A custom chip next to the number (e.g. "3 online") instead of a trend. */
  badge?: React.ReactNode;
}) {
  return (
    <div className="text-right">
      {/* h-11 matches the avatar beside these, so the numbers and the avatar
          share a top edge as well as a baseline, and the number centres on the
          circle rather than floating above it. */}
      <div className="flex h-11 items-center justify-end gap-1.5">
        <p className="text-2xl font-bold leading-none text-cream lg:text-3xl">{n}</p>
        {trend !== undefined && <TrendBadge value={trend} />}
        {badge}
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
    </div>
  );
}

function formatVisitDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function SnapshotCard({
  href,
  icon,
  eyebrow,
  title,
  detail,
  action,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group relative min-h-[158px] overflow-hidden rounded-3xl border border-[rgb(var(--c-cream))/0.05] bg-white/70 p-5 shadow-[0_10px_28px_rgb(16_45_35/0.05)] transition-all hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_35px_rgb(16_45_35/0.1)]"
    >
      <span
        className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 transition-transform duration-500 group-hover:scale-125"
        style={{ background: color }}
      />
      <span className="relative grid h-10 w-10 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }}>
        {icon}
      </span>
      <span className="relative mt-4 block">
        <span className="label block text-[10px]">{eyebrow}</span>
        <span className="mt-1 block truncate text-base font-bold text-cream">{title}</span>
        <span className="mt-1 block min-h-8 text-xs leading-relaxed text-[var(--text-muted)]">{detail}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color }}>
          {action} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  );
}

function CareChip({
  icon,
  label,
  sub,
  href,
  onClick,
  color = "#0A84FF",
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  color?: string;
}) {
  const inner = (
    <span className="group relative flex h-full min-h-[112px] flex-col items-start justify-between overflow-hidden rounded-2xl border border-[rgb(var(--c-cream))/0.05] bg-white/70 p-4 text-left shadow-[0_10px_24px_rgb(16_45_35/0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_30px_rgb(16_45_35/0.1)] active:scale-[0.97]">
      <span
        className="grid h-11 w-11 place-items-center rounded-full"
        style={{ background: `${color}26`, color }}
      >
        {icon}
      </span>
      <span>
        <span className="block text-[13px] font-bold text-cream">{label}</span>
        {sub && <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">{sub}</span>}
      </span>
      <ArrowRight className="absolute right-3 top-3 h-3.5 w-3.5 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5" />
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
