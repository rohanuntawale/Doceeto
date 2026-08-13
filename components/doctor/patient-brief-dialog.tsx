"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Droplets,
  HeartPulse,
  Loader2,
  MapPin,
  Phone,
  Pill,
  Ruler,
  Scissors,
  Users,
  Weight,
} from "lucide-react";
import { AvatarImage } from "@/components/ui/avatar-image";
import { Modal, modalPanelCls } from "@/components/ui/modal";
import { StarDisplay } from "@/components/ui/star-rating";
import { apiFetch } from "@/lib/api/client";
import {
  ACTIVITY_LABEL,
  BMI_BAND_LABEL,
  ageFrom,
  bmiBand,
  bmiOf,
  cmToInches,
  type HealthProfile,
} from "@/lib/health/profile";
import { idrsOf } from "@/lib/health/score";
import { cn } from "@/lib/utils/cn";

interface Brief {
  id: string;
  name: string;
  address: string;
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
  healthProfile?: HealthProfile;
  memberSince?: string;
  /** Newest first — appended automatically on every profile weight change. */
  weightHistory?: { value: number; recordedAt: string }[];
}

/**
 * Everything the platform knows about the patient, for the doctor who has
 * ACCEPTED their consult: measurements + BMI, blood group, allergies (loud,
 * first), conditions, medication, history, lifestyle, emergency contact.
 * The server enforces that only the holding doctor can fetch this.
 */
export function PatientBriefDialog({
  requestId,
  open,
  onClose,
}: {
  requestId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    apiFetch(`/api/patient-brief?requestId=${encodeURIComponent(requestId)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "Couldn't load the patient's details.");
        setBrief(body.brief);
        setPreview(Boolean(body.preview));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the patient's details."))
      .finally(() => setLoading(false));
  }, [open, requestId]);

  const p = brief?.healthProfile;
  const bmi = p ? bmiOf(p) : undefined;
  const age = ageFrom(p?.dob);

  return (
    <Modal open={open} onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={modalPanelCls}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-cream">
          <HeartPulse className="h-5 w-5 text-salmon" /> Patient details
        </h2>

        {/* Says plainly that this is the pre-accept view, so nothing reads as
            missing data when it is simply withheld until the visit is taken. */}
        {preview && !loading && (
          <p className="mt-2 rounded-lg border border-tan/30 bg-tan/10 px-3 py-2 text-xs leading-relaxed text-tan">
            Medical history only. The address and emergency contact appear once you
            accept the visit.
          </p>
        )}

        {loading && (
          <div className="grid place-items-center py-10 text-[var(--text-muted)]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && <p className="mt-4 text-sm text-status-critical">{error}</p>}

        {brief && !loading && (
          <div className="mt-4 space-y-4">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <AvatarImage
                src={brief.avatarUrl}
                className="h-12 w-12 rounded-full bg-terracotta/20 text-lg font-semibold text-salmon"
                fallback={brief.name.charAt(0).toUpperCase()}
              />
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-medium text-cream">
                  {brief.name}
                  {(brief.rating ?? 0) > 0 && (
                    <StarDisplay value={brief.rating!} count={brief.ratingCount} />
                  )}
                </p>
                <p className="flex items-center gap-1 truncate text-xs text-[var(--text-muted)]">
                  <MapPin className="h-3 w-3 shrink-0" /> {brief.address || "No address on file"}
                </p>
              </div>
            </div>

            {!p && (
              <p className="rounded-xl bg-white/5 px-3.5 py-3 text-sm text-[var(--text-muted)]">
                This patient hasn&apos;t filled in their health profile yet.
              </p>
            )}

            {p && (
              <>
                {/* Allergies first — the line that changes what you prescribe. */}
                {p.allergies && (
                  <div className="flex items-start gap-2 rounded-xl border border-status-critical/40 bg-status-critical/10 px-3.5 py-2.5 text-sm text-status-critical">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><span className="font-semibold">Allergies:</span> {p.allergies}</span>
                  </div>
                )}

                {/* Vitals grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Vital icon={<Ruler className="h-3.5 w-3.5" />} label="Height"
                    value={p.heightCm ? `${p.heightCm} cm` : "—"} />
                  <Vital icon={<Weight className="h-3.5 w-3.5" />} label="Weight"
                    value={p.weightKg ? `${p.weightKg} kg` : "—"} />
                  <Vital
                    icon={<HeartPulse className="h-3.5 w-3.5" />}
                    label="BMI"
                    value={bmi !== undefined ? `${bmi}` : "—"}
                    sub={bmi !== undefined ? BMI_BAND_LABEL[bmiBand(bmi)] : undefined}
                    warn={bmi !== undefined && bmiBand(bmi) !== "healthy"}
                  />
                  <Vital label="Age" value={age !== undefined ? `${age} yrs` : "—"} />
                  <Vital label="Gender" value={p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : "—"} />
                  <Vital icon={<Droplets className="h-3.5 w-3.5" />} label="Blood group"
                    value={p.bloodGroup ?? "—"} />
                  <Vital label="Waist" value={p.waistCm ? `${cmToInches(p.waistCm)} in` : "—"} />
                  <Vital
                    label="Diabetes"
                    value={p.diabetes ? (p.diabetes === "yes" ? "Yes" : "No") : "—"}
                    warn={p.diabetes === "yes"}
                  />
                  <Vital
                    label="High BP"
                    value={p.hypertension ? (p.hypertension === "yes" ? "Yes" : "No") : "—"}
                    warn={p.hypertension === "yes"}
                  />
                </div>

                {/* Weight trajectory — the log every profile edit feeds. */}
                {brief.weightHistory && brief.weightHistory.length >= 2 && (
                  <p className="rounded-xl bg-white/5 px-3.5 py-2.5 text-sm text-[var(--text-muted)]">
                    <span className="font-medium text-cream">Weight trend: </span>
                    {[...brief.weightHistory]
                      .reverse()
                      .map((w) => `${w.value} kg`)
                      .join(" → ")}
                    <span className="text-[var(--text-faint)]">
                      {" "}
                      (since {new Date(brief.weightHistory[brief.weightHistory.length - 1].recordedAt).toLocaleDateString()})
                    </span>
                  </p>
                )}

                {/* Validated Indian Diabetes Risk Score, when computable. */}
                {(() => {
                  const idrs = idrsOf(p);
                  if (!idrs) return null;
                  const high = idrs.band === "high";
                  return (
                    <p
                      className={cn(
                        "rounded-xl px-3.5 py-2.5 text-sm",
                        high
                          ? "bg-status-critical/10 text-status-critical"
                          : idrs.band === "moderate"
                            ? "bg-tan/12 text-tan"
                            : "bg-[rgb(var(--c-status-ok))]/10 text-[rgb(var(--c-status-ok))]",
                      )}
                    >
                      <span className="font-semibold">Diabetes risk (IDRS): </span>
                      {idrs.band[0].toUpperCase() + idrs.band.slice(1)} · {idrs.score}/{idrs.max}
                    </p>
                  );
                })()}

                {/* Clinical narrative */}
                <div className="space-y-2.5">
                  <Line icon={<HeartPulse className="h-4 w-4 text-salmon" />} label="Ongoing conditions" value={p.conditions} />
                  <Line icon={<Pill className="h-4 w-4 text-salmon" />} label="Current medication" value={p.medications} />
                  <Line icon={<Scissors className="h-4 w-4 text-salmon" />} label="Past surgeries" value={p.surgeries} />
                  <Line icon={<Users className="h-4 w-4 text-salmon" />} label="Family history" value={p.familyHistory} />
                  <Line
                    icon={<HeartPulse className="h-4 w-4 text-salmon" />}
                    label="Daily activity"
                    value={p.activity ? ACTIVITY_LABEL[p.activity] : undefined}
                  />
                  <Line
                    icon={<Phone className="h-4 w-4 text-salmon" />}
                    label="Emergency contact"
                    value={
                      p.emergencyContactName
                        ? `${p.emergencyContactName}${p.emergencyContactPhone ? ` · ${p.emergencyContactPhone}` : ""}`
                        : undefined
                    }
                  />
                </div>

                {p.updatedAt && (
                  <p className="text-[11px] text-[var(--text-faint)]">
                    Last updated by the patient on {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-cream transition-colors hover:bg-white/5"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

function Vital({
  icon,
  label,
  value,
  sub,
  warn,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className={cn("rounded-xl bg-white/5 px-3 py-2.5", warn && "bg-tan/12")}>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
        {icon} {label}
      </p>
      <p className={cn("mt-0.5 text-sm font-semibold text-cream", warn && "text-tan")}>{value}</p>
      {sub && <p className={cn("text-[11px]", warn ? "text-tan" : "text-[var(--text-muted)]")}>{sub}</p>}
    </div>
  );
}

function Line({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-[var(--text-faint)]">{label}: </span>
        <span className={value ? "text-cream" : "text-[var(--text-faint)]"}>
          {value ?? "Not provided"}
        </span>
      </div>
    </div>
  );
}
