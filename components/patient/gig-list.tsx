"use client";

/**
 * The gigs a doctor offers, and hiring one.
 *
 * This is the primary way a patient engages a doctor: pick a package, see
 * exactly what it costs and how long it takes, hire it. The appointment picker
 * is the fallback for doctors who publish no gigs.
 *
 * Whether hiring is allowed comes from the parent's `useDoctorSchedule` call so
 * the page polls the availability endpoint once, not once per card.
 */
import { useState } from "react";
import {
  Video,
  Home,
  Building2,
  Clock,
  Check,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useActions } from "@/lib/hooks/data";
import { ensureLocated } from "@/lib/hooks/use-current-patient";
import { formatGigDuration } from "@/lib/gigs/rules";
import { formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Doctor, Gig } from "@/lib/types/domain";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";

const typeIcon = {
  video: <Video className="h-3.5 w-3.5" />,
  home_visit: <Home className="h-3.5 w-3.5" />,
  clinic: <Building2 className="h-3.5 w-3.5" />,
};

const whereLabel = {
  video: "Video call",
  home_visit: "They come to you",
  clinic: "At their clinic",
};

export function GigList({
  doctor,
  gigs,
  patient,
  hireable,
  lockedReason,
  onHired,
}: {
  doctor: Doctor;
  /** Active gigs only — the server filters when read with ?doctorId=. */
  gigs: Gig[];
  patient: PatientIdentity;
  /** False while the doctor is on a gig or mid-consult. */
  hireable: boolean;
  /** Shown in place of the price line when hiring is closed. */
  lockedReason?: string;
  onHired: () => void;
}) {
  const toast = useToast();
  const { createRequest } = useActions();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (gigs.length === 0) return null;

  async function hire(gig: Gig) {
    if (!hireable || busy) return;
    const liveLocation = gig.type === "home_visit" ? await ensureLocated(patient) : null;
    if (gig.type === "home_visit" && !liveLocation) {
      toast.push({
        tone: "error",
        title: "We need your location",
        desc: "Allow location access so the doctor reaches the right address.",
      });
      return;
    }
    setBusy(true);
    try {
      await createRequest({
        patientId: patient.id,
        patientName: patient.name,
        mode: "gig",
        gigId: gig.id,
        doctorId: doctor.id,
        // The gig decides the price, visit type and duration server-side, so
        // these carry no weight — they only keep the shared input shape valid.
        type: gig.type,
        fee: gig.price,
        symptoms: note.trim() || "Hired a gig.",
        address:
          gig.type === "home_visit"
            ? patient.address || "Your address"
            : gig.type === "clinic"
              ? doctor.clinicAddress || "At the doctor's clinic"
              : "Video call",
        lat: liveLocation?.lat ?? patient.lat,
        lng: liveLocation?.lng ?? patient.lng,
      });
      toast.push({
        tone: "success",
        title: `Sent to ${doctor.fullName}`,
        desc: "You'll see it under your care the moment they take it.",
      });
      setSelected(null);
      setNote("");
      onHired();
    } catch (e) {
      // The server owns whether a doctor is free; show exactly what it said.
      toast.push({
        tone: "error",
        title: "Couldn't hire that gig",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {gigs.map((gig) => {
        const open = selected === gig.id;
        return (
          <div
            key={gig.id}
            className={cn(
              "rounded-lg border transition-colors",
              open ? "border-terracotta bg-terracotta/[0.06]" : "border-[var(--border)]",
            )}
          >
            <button
              type="button"
              onClick={() => setSelected(open ? null : gig.id)}
              className="flex w-full items-start gap-3 p-3.5 text-left"
            >
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-terracotta/10 text-salmon">
                <Briefcase className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cream">{gig.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1 text-salmon">
                    {typeIcon[gig.type]}
                    {whereLabel[gig.type]}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatGigDuration(gig.durationMinutes)}
                  </span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-cream">
                  {formatINR(gig.price)}
                </div>
                <ChevronDown
                  className={cn(
                    "ml-auto mt-1 h-4 w-4 text-[var(--text-faint)] transition-transform",
                    open && "rotate-180",
                  )}
                />
              </div>
            </button>

            {open && (
              <div className="border-t border-[var(--border)] px-3.5 pb-3.5 pt-3">
                {gig.description && (
                  <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                    {gig.description}
                  </p>
                )}

                {hireable ? (
                  <>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Anything they should know? e.g. fever for two days"
                      className="mt-3 w-full resize-none rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
                    />
                    <button
                      type="button"
                      onClick={() => hire(gig)}
                      disabled={busy}
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {busy ? (
                        "Sending…"
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Hire for {formatINR(gig.price)}
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-center text-[11px] text-[var(--text-faint)]">
                      They&apos;ll confirm before anything is charged.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 rounded-lg bg-tan/10 p-3 text-xs leading-relaxed text-tan">
                    {lockedReason ??
                      `${doctor.fullName} can't take this on right now. Try again shortly.`}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
