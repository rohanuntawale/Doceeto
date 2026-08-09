"use client";

/**
 * One prescription, in full.
 *
 * The document comes first and everything else sits under it, because the
 * reason someone opens this screen is to read what they were told to take —
 * or to hand the screen to a chemist. Sharing, saving and the follow-up
 * booking are what you do after you have read it, so they follow it.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarPlus, Stethoscope } from "lucide-react";
import { PrescriptionSheet } from "@/components/prescription/prescription-sheet";
import { PrescriptionActions } from "@/components/prescription/prescription-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { usePrescriptions, useConsultRequests } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { useT } from "@/lib/i18n";

export default function PrescriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const { patient } = useCurrentPatient();
  const { t } = useT();
  const prescriptions = usePrescriptions();
  const requests = useConsultRequests();

  const rx = prescriptions.find(
    (x) => x.id === id && (!x.patientId || x.patientId === patient.id),
  );

  if (!rx) {
    return (
      <>
        <BackLink label={t("rx.backToList")} />
        <EmptyState
          title={t("rx.notFoundTitle")}
          desc={t("rx.notFoundDesc")}
          action={
            <Link
              href="/patient/prescriptions"
              className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-on-accent"
            >
              {t("rx.backToList")}
            </Link>
          }
        />
      </>
    );
  }

  // The consult this closed — the way back to the doctor who wrote it.
  const consult = requests.find((r) => r.id === rx.requestId);

  return (
    <div className="space-y-4">
      <BackLink label={t("rx.backToList")} />

      <PrescriptionSheet rx={rx} />

      <PrescriptionActions rx={rx} />

      <p className="no-print px-1 text-xs leading-relaxed text-[var(--text-faint)]">
        {t("rx.shareNote")}
      </p>

      {/* The next thing, when there is one. A follow-up date on a document is
          only useful if booking it is one tap from reading it. */}
      <div className="no-print grid gap-2 sm:grid-cols-2">
        {consult?.doctorId && (
          <Link
            href={`/patient/doctors/${consult.doctorId}`}
            className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-cream transition-colors hover:border-terracotta/50 hover:bg-white/5"
          >
            <Stethoscope className="h-4 w-4 shrink-0 text-salmon" />
            <span className="min-w-0 truncate">{t("rx.viewDoctor", { name: rx.doctorName })}</span>
          </Link>
        )}
        {rx.followUpDays && consult?.doctorId && (
          <Link
            href={`/patient/doctors/${consult.doctorId}`}
            className="flex items-center gap-2.5 rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta transition-colors hover:bg-terracotta/15"
          >
            <CalendarPlus className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">
              {t("rx.bookFollowUp", { n: String(rx.followUpDays) })}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/patient/prescriptions"
      className="no-print mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-cream"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </Link>
  );
}
