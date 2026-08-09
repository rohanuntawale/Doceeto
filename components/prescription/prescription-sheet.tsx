/**
 * The prescription, as a document.
 *
 * ONE component renders it everywhere it appears — the patient's app, the
 * doctor's confirmation, the shared /rx/<token> link a chemist opens, and
 * paper. That is the point: a prescription that looked different in three
 * places would be three documents, and only one of them would be believed at a
 * counter. Anything specific to a surface (share buttons, ordering) wraps this;
 * nothing forks it.
 *
 * Deliberately pure — no hooks, no data fetching — so the public share page can
 * render it on the server with no session at all.
 *
 * The design follows the paper pad it replaces, because that is the object
 * everyone involved already knows how to read: a letterhead carrying the
 * doctor's credentials and council registration, the ℞ mark anchoring the left
 * margin, a numbered list of medicines, advice, and a signature block. The one
 * thing paper cannot do is the dose ledger below.
 */
import { Sunrise, Sun, Moon, CalendarClock, ShieldCheck } from "lucide-react";
import { SCHEDULE_TIME_ZONE } from "@/lib/scheduling/time";
import { courseSummary, formatSchedule, parseSchedule, RX_TIMINGS } from "@/lib/prescriptions/rules";
import { cn } from "@/lib/utils/cn";
import type { Prescription, RxItem } from "@/lib/types/domain";

/**
 * The day-parts, in the order they are spoken, printed and lived. Index
 * matches parseSchedule's output, so the ledger and the "1-0-1" notation can
 * never disagree.
 */
const PARTS = [
  { key: "morning", label: "Morning", Icon: Sunrise },
  { key: "afternoon", label: "Afternoon", Icon: Sun },
  { key: "night", label: "Night", Icon: Moon },
] as const;

/** Fixed to IST so the server and the browser print the same date. */
function issuedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SCHEDULE_TIME_ZONE,
  });
}

/**
 * THE dose ledger — when to take this, not just how often.
 *
 * "1-0-1" is the notation every doctor here already writes and most patients
 * have seen, but it is a code: it tells you nothing unless someone taught you
 * to read it. Drawing it as three day-parts, filled or empty, means the person
 * holding the phone at eight in the evening can answer "do I take one now?"
 * without reading the drug name, the language, or the notation. That is the
 * whole reason this is a picture and not a sentence.
 */
export function DoseLedger({ schedule }: { schedule: string }) {
  const counts = parseSchedule(schedule);
  return (
    <div className="flex items-stretch gap-1.5" aria-label={`Doses: ${formatSchedule(schedule)}`}>
      {PARTS.map(({ key, label, Icon }, i) => {
        const n = counts[i] ?? 0;
        const due = n > 0;
        return (
          <div
            key={key}
            title={due ? `${label}: ${n === 0.5 ? "½" : n}` : `${label}: none`}
            className={cn(
              "flex w-[3.25rem] flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition-colors",
              due
                ? "border-terracotta/45 bg-terracotta/12 text-terracotta"
                : "border-[var(--border)] text-[var(--text-faint)]",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", !due && "opacity-45")} aria-hidden />
            <span className="font-mono text-[13px] font-bold leading-none">
              {n === 0 ? "—" : n === 0.5 ? "½" : n}
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.08em] leading-none">
              {label.slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** One medicine: the drug, its course, and the ledger. */
function MedicineRow({ item, index }: { item: RxItem; index: number }) {
  const timing = RX_TIMINGS.find((x) => x.value === item.timing);
  return (
    // Wraps rather than squeezes: on a narrow phone the ledger drops to its own
    // line under the medicine instead of crushing the drug name into a column
    // one word wide — the name is the thing a chemist reads first.
    <li className="flex flex-wrap items-start gap-x-3 py-3.5 first:pt-0 last:pb-0">
      {/* The number is information, not decoration: a chemist reads down an
          ordered list and ticks items off it. */}
      <span className="mt-0.5 font-mono text-xs font-semibold text-[var(--text-faint)]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-[15px] font-semibold leading-snug text-cream">{item.name}</p>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.dose}</span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{courseSummary(item)}</p>
        {item.notes && (
          <p className="mt-1.5 border-l-2 border-tan/40 pl-2 text-xs italic leading-relaxed text-tan">
            {item.notes}
          </p>
        )}
      </div>
      <div className="mt-2.5 flex basis-full flex-col items-start gap-1 pl-7 sm:mt-0 sm:basis-auto sm:items-end sm:pl-0">
        <DoseLedger schedule={item.schedule} />
        <span className="font-mono text-[10px] tracking-wider text-[var(--text-faint)]">
          {formatSchedule(item.schedule)}
          {timing && item.timing !== "anytime" ? ` · ${item.timing === "after_food" ? "p.c." : "a.c."}` : ""}
        </span>
      </div>
    </li>
  );
}

/** A labelled block in the document body. */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="mt-1 text-sm leading-relaxed text-cream">{children}</div>
    </div>
  );
}

/** One line of the patient/issue header: a label and its value. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-cream">{value}</p>
    </div>
  );
}

export function PrescriptionSheet({
  rx,
  className,
}: {
  rx: Prescription;
  className?: string;
}) {
  const patientLine = [
    rx.patientName,
    rx.patientAge ? `${rx.patientAge} yrs` : null,
    rx.patientGender ? rx.patientGender[0].toUpperCase() + rx.patientGender.slice(1) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "rx-sheet overflow-hidden rounded-card border border-[var(--border)] bg-espresso-800 shadow-card",
        className,
      )}
    >
      {/* The one band of colour on the document. A letterhead earns its accent
          at the top edge and nowhere else. */}
      <div className="h-1 bg-terracotta" aria-hidden />

      <header className="px-5 pt-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl leading-tight text-cream">{rx.doctorName}</h1>
            {rx.doctorQualifications && (
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{rx.doctorQualifications}</p>
            )}
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {rx.doctorSpecialty}
              {rx.doctorRegistrationNo && (
                <>
                  {rx.doctorSpecialty ? " · " : ""}
                  <span className="font-mono">Reg. {rx.doctorRegistrationNo}</span>
                </>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="label">Doceeto</p>
            <p className="mt-0.5 font-serif text-base text-cream">Prescription</p>
            <p className="mt-0.5 font-mono text-[11px] tracking-wider text-terracotta">{rx.code}</p>
          </div>
        </div>
        {/* The double rule — the letterhead convention that separates who wrote
            this from what it says. */}
        <div className="mt-4 border-t-[3px] border-double border-[var(--border)]" aria-hidden />
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3 sm:px-7">
        <Field label="Patient" value={patientLine} />
        <Field label="Issued" value={issuedOn(rx.issuedAt)} />
        {rx.patientAllergies && (
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <p className="label text-status-critical">Allergies</p>
            <p className="mt-0.5 text-sm font-semibold text-status-critical">
              {rx.patientAllergies}
            </p>
          </div>
        )}
      </div>

      {rx.diagnosis && (
        <div className="border-t border-[var(--border)] px-5 py-4 sm:px-7">
          <Block label="Diagnosis">{rx.diagnosis}</Block>
        </div>
      )}

      {/* The medicines, with ℞ anchoring the margin exactly as on a pad. */}
      <div className="border-t border-[var(--border)] px-5 py-4 sm:px-7">
        <div className="flex gap-4">
          <span
            aria-hidden
            className="shrink-0 select-none font-serif text-4xl leading-none text-terracotta/70"
          >
            ℞
          </span>
          <div className="min-w-0 flex-1">
            {rx.items.length === 0 ? (
              <p className="py-2 text-sm text-[var(--text-muted)]">
                No medicines prescribed — follow the advice below.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {rx.items.map((item, i) => (
                  <MedicineRow key={`${item.name}-${i}`} item={item} index={i} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {(rx.advice || rx.followUpDays) && (
        <div className="space-y-4 border-t border-[var(--border)] px-5 py-4 sm:px-7">
          {rx.advice && <Block label="Advice">{rx.advice}</Block>}
          {rx.followUpDays && (
            // One string, not a sentence built from JSX fragments — those left
            // a stray space before the comma and broke across lines mid-clause.
            <p className="flex items-start gap-2 text-sm leading-relaxed text-cream">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-tan" />
              <span>
                Come back in {rx.followUpDays} {rx.followUpDays === 1 ? "day" : "days"}, or sooner
                if you feel worse.
              </span>
            </p>
          )}
        </div>
      )}

      {/* The signature block. On paper this is a scrawl and a stamp; here it is
          the fact that the platform issued it, which is what the code and the
          registration number are for. */}
      <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--border)] px-5 py-4 sm:px-7">
        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-status-ok" />
          Issued digitally on Doceeto. Valid without a signature.
        </p>
        <div className="text-right">
          <p className="font-serif text-base text-cream">{rx.doctorName}</p>
          {rx.doctorRegistrationNo && (
            <p className="font-mono text-[10px] text-[var(--text-faint)]">
              Reg. {rx.doctorRegistrationNo}
            </p>
          )}
        </div>
      </footer>
    </article>
  );
}
