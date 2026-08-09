"use client";

/**
 * "Get care now" — the dispatch path.
 *
 * Unlike hiring a gig or booking a slot, the patient names no doctor. The
 * request goes out to every free doctor in range and the first to accept wins;
 * the rest see it disappear. That is why this screen has two states: compose,
 * then watch for a claim.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Zap,
  Video,
  Home,
  Building2,
  MapPin,
  Radio,
  Check,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { useActions, useConsultRequests, useDoctors } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { useMounted } from "@/lib/hooks/use-mounted";
import { bookingModeOf } from "@/lib/scheduling/slots";
import { haversineKm } from "@/lib/utils/geo";
import { formatINR, initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { DoctorAvatar } from "@/components/ui/doctor-avatar";
import type { ConsultType } from "@/lib/types/domain";

/** How far out a broadcast is considered "nearby", matching the server fan-out. */
const RADIUS_KM = 15;

const WHERE: {
  type: ConsultType;
  label: string;
  icon: React.ReactNode;
  help: string;
}[] = [
  { type: "home_visit", label: "Come to me", icon: <Home className="h-4 w-4" />, help: "Home visit" },
  { type: "video", label: "Video call", icon: <Video className="h-4 w-4" />, help: "Right now" },
  { type: "clinic", label: "I'll travel", icon: <Building2 className="h-4 w-4" />, help: "At their clinic" },
];

export default function CareNowPage() {
  const router = useRouter();
  const toast = useToast();
  const mounted = useMounted();
  const { patient } = useCurrentPatient();
  const { createRequest } = useActions();
  const doctors = useDoctors();
  const requests = useConsultRequests();

  const [symptoms, setSymptoms] = useState("");
  const [type, setType] = useState<ConsultType>("home_visit");
  const [budget, setBudget] = useState(800);
  const [posting, setPosting] = useState(false);
  /** Set once the broadcast is out — switches this page into watch mode. */
  const [postedId, setPostedId] = useState<string | null>(null);

  // Who could pick this up. Only online doctors carry live coordinates (the
  // API zeroes them for offline ones), so this is a fair estimate of reach.
  const inRange = useMemo(
    () =>
      doctors.filter(
        (d) =>
          d.status === "online" &&
          (d.lat !== 0 || d.lng !== 0) &&
          haversineKm(patient, d) <= RADIUS_KM,
      ),
    [doctors, patient],
  );

  const posted = postedId ? requests.find((r) => r.id === postedId) : undefined;
  const claimedBy = posted?.doctorId
    ? doctors.find((d) => d.id === posted.doctorId)
    : undefined;

  // The moment a doctor claims it, hand off to the dashboard where the live
  // tracker takes over — this page has done its job.
  useEffect(() => {
    if (posted?.status !== "accepted") return;
    const t = setTimeout(() => router.push("/patient"), 1600);
    return () => clearTimeout(t);
  }, [posted?.status, router]);

  async function broadcast() {
    if (posting) return;
    setPosting(true);
    try {
      // doctorId: null is what makes this a broadcast rather than a request
      // aimed at one doctor.
      await createRequest({
        patientId: patient.id,
        patientName: patient.name,
        doctorId: null,
        mode: "emergency",
        type,
        fee: budget,
        symptoms: symptoms.trim() || "Needs to be seen now.",
        // The FULL address travels on the booking — the doctor has to find a
        // door, and the short header label ("Sadar, Nagpur") cannot get them
        // there. Falls back to the label, then to a placeholder.
        address:
          type === "home_visit"
            ? patient.addressFull || patient.address || "Your address"
            : "To be confirmed",
        lat: patient.lat,
        lng: patient.lng,
      });
      // The store assigns the id, so pick the row back up from the feed.
      setPostedId("pending");
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Couldn't send that",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setPosting(false);
    }
  }

  // `broadcast` can't know the new row's id, so latch onto the newest urgent
  // broadcast of ours as soon as it appears in the feed.
  useEffect(() => {
    if (postedId !== "pending") return;
    const mine = requests
      .filter(
        (r) =>
          r.patientId === patient.id &&
          r.broadcast &&
          bookingModeOf(r) === "emergency" &&
          (r.status === "pending" || r.status === "accepted"),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    if (mine) setPostedId(mine.id);
  }, [postedId, requests, patient.id]);

  // ── Watching for a doctor ──────────────────────────────────
  if (postedId) {
    const accepted = posted?.status === "accepted";
    return (
      <div className="space-y-5">
        <BackLink />
        <GlassCard className="p-6 text-center">
          <span
            className={cn(
              "mx-auto grid h-16 w-16 place-items-center rounded-full",
              accepted ? "bg-status-ok/15 text-status-ok" : "bg-terracotta/15 text-salmon",
            )}
          >
            {accepted ? (
              <Check className="h-7 w-7" />
            ) : (
              <Radio className="h-7 w-7 animate-pulse" />
            )}
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-cream">
            {accepted ? "A doctor took it" : "Finding you a doctor"}
          </h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">
            {accepted
              ? `${claimedBy?.fullName ?? "Your doctor"} is on it. Taking you to your care…`
              : `Sent to ${inRange.length} doctor${inRange.length === 1 ? "" : "s"} within ${RADIUS_KM} km. The first to accept gets it.`}
          </p>

          {accepted && claimedBy && (
            <div className="mx-auto mt-5 flex max-w-xs items-center gap-3 rounded-2xl fh-card p-3.5 text-left">
              <DoctorAvatar
                doctor={claimedBy}
                className="h-11 w-11 rounded-xl text-sm font-semibold text-white"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-cream">
                  {claimedBy.fullName}
                </p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {claimedBy.specialty}
                </p>
              </div>
              <StatusPill tone="ok" className="ml-auto shrink-0">
                On the way
              </StatusPill>
            </div>
          )}

          {!accepted && (
            <>
              <div className="mx-auto mt-5 flex max-w-xs flex-wrap items-center justify-center gap-2">
                {inRange.slice(0, 6).map((d, i) => (
                  <DoctorAvatar
                    key={d.id}
                    doctor={d}
                    className="h-9 w-9 rounded-xl text-[11px] font-semibold text-white opacity-90"
                    style={{ animation: `pulse 2s ${i * 0.2}s infinite` }}
                    title={d.fullName}
                  />
                ))}
                {inRange.length === 0 && (
                  <p className="text-xs text-tan">
                    No doctors are online nearby right now — it stays open until one is.
                  </p>
                )}
              </div>
              <CancelBroadcast
                requestId={posted && posted.id !== "pending" ? posted.id : null}
                onCancelled={() => {
                  setPostedId(null);
                  toast.push({ tone: "success", title: "Request called off" });
                }}
              />
            </>
          )}
        </GlassCard>
      </div>
    );
  }

  // ── Compose ────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <BackLink />

      <header>
        <div className="label text-salmon">TASUKE · CARE NOW</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-cream lg:text-4xl">
          Get care now
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          We&apos;ll send this to every free doctor near you. The first to accept takes it —
          you don&apos;t have to pick.
        </p>
      </header>

      <GlassCard className="p-5">
        <div className="label">What&apos;s wrong?</div>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          rows={3}
          maxLength={1000}
          autoFocus
          placeholder="e.g. High fever since last night, bad headache"
          className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-espresso px-3.5 py-3 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
        />

        <div className="label mt-5">How should they see you?</div>
        {/* Stacks on the narrowest phones — three-up leaves ~60px per tile
            at 320px, too little for the helper line. */}
        <div className="mt-2 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
          {WHERE.map((w) => {
            const active = type === w.type;
            return (
              <button
                key={w.type}
                type="button"
                onClick={() => setType(w.type)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors",
                  active
                    ? "border-terracotta bg-terracotta/10"
                    : "border-[var(--border)] hover:border-terracotta/40",
                )}
              >
                <span className="text-salmon">{w.icon}</span>
                <span className="text-xs font-medium text-cream">{w.label}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{w.help}</span>
              </button>
            );
          })}
        </div>

        <div className="label mt-5">What you&apos;ll pay</div>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={300}
            max={3000}
            step={100}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="h-1.5 flex-1 accent-[rgb(var(--c-terracotta))]"
          />
          <span className="w-20 shrink-0 text-right text-lg font-semibold text-cream">
            {formatINR(budget)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-faint)]">
          A higher offer reaches doctors further out. Nothing is charged until the visit
          is done.
        </p>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-tan/10 p-3 text-xs leading-relaxed text-tan">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Sending from <span className="font-medium">{patient.address || "your location"}</span>.
            {mounted && ` ${inRange.length} doctor${inRange.length === 1 ? "" : "s"} online within ${RADIUS_KM} km.`}
          </span>
        </div>

        <button
          type="button"
          onClick={broadcast}
          disabled={posting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {posting ? (
            "Sending…"
          ) : (
            <>
              <Zap className="h-4 w-4" /> Send to doctors nearby
            </>
          )}
        </button>
      </GlassCard>

      <p className="text-center text-xs text-[var(--text-faint)]">
        Want a specific doctor?{" "}
        <Link href="/patient/doctors" className="text-salmon underline">
          Browse gigs and profiles
        </Link>{" "}
        instead.
      </p>
    </div>
  );
}

/** Calling off a broadcast before anyone takes it. */
function CancelBroadcast({
  requestId,
  onCancelled,
}: {
  requestId: string | null;
  onCancelled: () => void;
}) {
  const { cancelRequest } = useActions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!requestId) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await cancelRequest(requestId);
          onCancelled();
        } catch (e) {
          toast.push({
            tone: "error",
            title: "Couldn't call that off",
            desc: e instanceof Error ? e.message : "Please try again.",
          });
        } finally {
          setBusy(false);
        }
      }}
      className="mx-auto mt-6 flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-cream disabled:opacity-50"
    >
      <X className="h-3.5 w-3.5" /> {busy ? "Calling off…" : "Call it off"}
    </button>
  );
}

function BackLink() {
  return (
    <Link
      href="/patient"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-cream"
    >
      <ArrowLeft className="h-4 w-4" /> Home
    </Link>
  );
}
