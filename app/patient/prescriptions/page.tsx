"use client";

/**
 * The patient's prescriptions.
 *
 * A record, so it is ordered by when it was issued and says who wrote it —
 * those are the two things someone scanning for "the one from the fever last
 * month" actually uses. The medicine names come along on the row because they
 * are the other way people recognise a prescription ("the one with the
 * antibiotic"), and because a row that only said "Prescription · 6 Aug" would
 * make you open all of them.
 */
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { usePrescriptions } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { useMounted } from "@/lib/hooks/use-mounted";
import { SCHEDULE_TIME_ZONE } from "@/lib/scheduling/time";
import { useT } from "@/lib/i18n";

export default function PrescriptionsPage() {
  const { patient } = useCurrentPatient();
  const { t } = useT();
  const mounted = useMounted();
  // The server already scopes this to the signed-in patient; the filter keeps
  // demo mode (one browser, many identities) honest too.
  const mine = usePrescriptions().filter((rx) => !rx.patientId || rx.patientId === patient.id);

  return (
    <>
      <PageHeader label={t("rx.pageLabel")} title={t("rx.pageTitle")} />

      {mine.length === 0 ? (
        <EmptyState
          title={t("rx.emptyTitle")}
          desc={t("rx.emptyDesc")}
          action={
            <Link
              href="/patient/doctors"
              className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-on-accent"
            >
              {t("rx.emptyCta")}
            </Link>
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {mine.map((rx) => (
              <li key={rx.id}>
                <Link
                  href={`/patient/prescriptions/${rx.id}`}
                  className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-white/[0.03] sm:px-5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-terracotta/12 font-serif text-lg text-terracotta">
                    ℞
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-cream">
                      {rx.diagnosis || t("rx.consultationRecord")}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {rx.doctorName}
                      {rx.doctorSpecialty ? ` · ${rx.doctorSpecialty}` : ""}
                    </p>
                    {rx.items.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-faint)]">
                        {rx.items.map((it) => it.name).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-[var(--text-muted)]">
                      {mounted
                        ? new Date(rx.issuedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: SCHEDULE_TIME_ZONE,
                          })
                        : ""}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[var(--text-faint)]">
                      {rx.code}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-relaxed text-[var(--text-faint)]">
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("rx.listFootnote")}
      </p>
    </>
  );
}
