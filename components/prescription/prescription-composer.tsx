"use client";

/**
 * Where a doctor writes the prescription that closes a consult.
 *
 * Built around one observation: the doctor is finishing a visit, often on a
 * phone, often standing up. So almost nothing here is typed. The drug name is,
 * because only the doctor knows it — everything after it (when, how long,
 * before or after food, when to come back) is a tap on a preset, because those
 * are the same six answers on nearly every prescription written. Typing a dose
 * schedule into a free-text box is how you get "1-0-1" in one row and "twice
 * daily" in the next, and then nothing downstream can read either.
 *
 * The presets are also what makes the dose ledger possible on the patient's
 * side: structured input in, a picture the patient can read out.
 *
 * Two ways out, and they are different acts, not a choice of wording:
 * issuing a prescription (which completes the visit), or completing the visit
 * with nothing prescribed — a real outcome, and the doctor should not have to
 * invent a medicine to reach it.
 */
import { useState } from "react";
import { Plus, Trash2, X, Loader2, Check, Pill, ClipboardList } from "lucide-react";
import { Modal, modalPanelCls } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PrescriptionSheet } from "@/components/prescription/prescription-sheet";
import { PrescriptionActions } from "@/components/prescription/prescription-actions";
import { useActions } from "@/lib/hooks/data";
import { MED_CATALOG } from "@/lib/catalog";
import {
  RX_LIMITS,
  RX_SCHEDULES,
  RX_TIMINGS,
  draftHasContent,
  sanitizeRxDraft,
} from "@/lib/prescriptions/rules";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import type { ConsultRequest, Prescription, RxItem, RxTiming } from "@/lib/types/domain";

/** Course lengths a doctor actually writes, as one tap each. */
const DURATIONS = [3, 5, 7, 10, 15];
/** Follow-up windows, same idea. `null` is "no follow-up needed". */
const FOLLOW_UPS: Array<number | null> = [null, 3, 7, 14, 30];

const blankItem = (name = ""): RxItem => ({
  name,
  dose: "1 tablet",
  schedule: "1-0-1",
  durationDays: 5,
  timing: "after_food",
});

export function PrescriptionComposer({
  request,
  open,
  onClose,
}: {
  request: ConsultRequest;
  open: boolean;
  onClose: () => void;
}) {
  const { issuePrescription, completeRequest } = useActions();
  const toast = useToast();
  const { t } = useT();

  const [diagnosis, setDiagnosis] = useState("");
  const [items, setItems] = useState<RxItem[]>([blankItem()]);
  const [advice, setAdvice] = useState("");
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set once issued — the composer becomes the receipt. */
  const [issued, setIssued] = useState<Prescription | null>(null);

  const patch = (i: number, next: Partial<RxItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...next } : it)));

  const draft = sanitizeRxDraft({ diagnosis, items, advice, followUpDays });
  const canIssue = draftHasContent(draft);

  async function issue() {
    setBusy(true);
    try {
      const rx = await issuePrescription(request.id, draft);
      setIssued(rx);
      toast.push({ tone: "success", title: t("rx.issuedToast"), desc: t("rx.issuedToastDesc") });
    } catch (e) {
      toast.push({
        tone: "error",
        title: t("rx.issueFailed"),
        desc: e instanceof Error ? e.message : t("common.retry"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function completeOnly() {
    setBusy(true);
    try {
      await completeRequest(request.id);
      toast.push({ tone: "success", title: t("trip.completedToast"), desc: t("trip.completedToastDesc") });
      onClose();
    } catch (e) {
      toast.push({
        tone: "error",
        title: t("trip.updateFailed"),
        desc: e instanceof Error ? e.message : t("common.retry"),
      });
    } finally {
      setBusy(false);
    }
  }

  // ── Issued: the composer turns into the document it just produced ──
  if (issued) {
    return (
      <Modal open={open} onClose={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(modalPanelCls, "max-w-2xl p-0")}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-status-ok">
              <Check className="h-4 w-4" /> {t("rx.sentToPatient", { name: request.patientName })}
            </p>
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <PrescriptionSheet rx={issued} />
            <PrescriptionActions rx={issued} />
          </div>
        </div>
      </Modal>
    );
  }

  // ── Writing ──
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void issue();
        }}
        className={cn(modalPanelCls, "max-w-2xl p-0")}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-espresso-800 px-5 py-4">
          <div className="min-w-0">
            <p className="label flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> {t("rx.composerLabel")}
            </p>
            <h2 className="mt-1 truncate font-serif text-xl text-cream">
              {t("rx.composerTitle", { name: request.patientName })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-6 px-5 py-5">
          {/* Diagnosis */}
          <Section label={t("rx.diagnosis")}>
            <input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              maxLength={RX_LIMITS.diagnosis}
              placeholder={t("rx.diagnosisPlaceholder")}
              className={inputCls}
            />
          </Section>

          {/* Medicines */}
          <Section label={t("rx.medicines")}>
            <div className="space-y-3">
              {items.map((item, i) => (
                <MedicineEditor
                  key={i}
                  item={item}
                  index={i}
                  onChange={(next) => patch(i, next)}
                  onRemove={
                    items.length > 1
                      ? () => setItems((prev) => prev.filter((_, idx) => idx !== i))
                      : undefined
                  }
                  t={t}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, blankItem()])}
              disabled={items.length >= RX_LIMITS.items}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-terracotta/50 hover:text-cream disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> {t("rx.addMedicine")}
            </button>

            {/* The stocked catalog, as one tap. Not a restriction — the name
                field takes anything — but the eight drugs the network can
                actually deliver are worth being one tap away. */}
            <div className="mt-3">
              <p className="label mb-1.5">{t("rx.commonMedicines")}</p>
              <div className="flex flex-wrap gap-1.5">
                {MED_CATALOG.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() =>
                      setItems((prev) => {
                        // Fill the first empty row rather than always appending,
                        // so the opening blank row isn't left stranded above.
                        const at = prev.findIndex((x) => !x.name.trim());
                        const next = blankItem(m.name);
                        if (at === -1) return [...prev, next];
                        return prev.map((x, idx) => (idx === at ? { ...x, name: m.name } : x));
                      })
                    }
                    className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:border-terracotta/50 hover:text-cream"
                  >
                    <Pill className="h-3 w-3 text-salmon" /> {m.name}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Advice */}
          <Section label={t("rx.advice")}>
            <textarea
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              maxLength={RX_LIMITS.advice}
              rows={3}
              placeholder={t("rx.advicePlaceholder")}
              className={cn(inputCls, "resize-y leading-relaxed")}
            />
          </Section>

          {/* Follow-up */}
          <Section label={t("rx.followUp")}>
            <ChipRow
              options={FOLLOW_UPS.map((d) => ({
                value: d,
                label: d === null ? t("rx.noFollowUp") : t("rx.inDays", { n: String(d) }),
              }))}
              value={followUpDays}
              onChange={setFollowUpDays}
            />
          </Section>
        </div>

        <footer className="sticky bottom-0 space-y-2 border-t border-[var(--border)] bg-espresso-800 px-5 py-4">
          <button
            type="submit"
            disabled={busy || !canIssue}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta py-3 text-sm font-bold text-on-accent transition-colors hover:bg-terracotta-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("rx.issueAndComplete")}
          </button>
          {/* A visit that needed no medicine is a real outcome, not a failure
              to fill this form in. */}
          <button
            type="button"
            onClick={completeOnly}
            disabled={busy}
            className="w-full py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-cream disabled:opacity-50"
          >
            {t("rx.completeWithout")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

// ── Pieces ───────────────────────────────────────────────────
const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream placeholder:text-[var(--text-faint)] focus:border-terracotta/60 focus:outline-none";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="label mb-2">{label}</p>
      {children}
    </section>
  );
}

/** A row of mutually exclusive taps. The composer's main input device. */
function ChipRow<T>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]",
              on
                ? "border-terracotta bg-terracotta/15 text-terracotta"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-terracotta/40 hover:text-cream",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MedicineEditor({
  item,
  index,
  onChange,
  onRemove,
  t,
}: {
  item: RxItem;
  index: number;
  onChange: (next: Partial<RxItem>) => void;
  onRemove?: () => void;
  t: (k: string, v?: Record<string, string>) => string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-espresso/60 p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-[var(--text-faint)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={RX_LIMITS.name}
          placeholder={t("rx.medicinePlaceholder")}
          className={cn(inputCls, "flex-1 font-medium")}
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("rx.removeMedicine")}
            className="shrink-0 rounded-lg p-2 text-[var(--text-faint)] transition-colors hover:bg-status-critical/10 hover:text-status-critical"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-3 pl-0 sm:pl-6">
        <div>
          <p className="label mb-1.5">{t("rx.whenToTake")}</p>
          <ChipRow
            options={RX_SCHEDULES.map((s) => ({ value: s.value, label: s.label }))}
            value={item.schedule}
            onChange={(schedule) => onChange({ schedule })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="label mb-1.5">{t("rx.dose")}</p>
            <input
              value={item.dose}
              onChange={(e) => onChange({ dose: e.target.value })}
              maxLength={RX_LIMITS.dose}
              placeholder="1 tablet"
              className={inputCls}
            />
          </div>
          <div>
            <p className="label mb-1.5">{t("rx.forHowLong")}</p>
            <ChipRow
              options={DURATIONS.map((d) => ({ value: d, label: t("rx.days", { n: String(d) }) }))}
              value={item.durationDays}
              onChange={(durationDays) => onChange({ durationDays })}
            />
          </div>
        </div>

        <div>
          <p className="label mb-1.5">{t("rx.timing")}</p>
          <ChipRow
            options={RX_TIMINGS.map((x) => ({ value: x.value, label: x.label }))}
            value={item.timing}
            onChange={(timing) => onChange({ timing: timing as RxTiming })}
          />
        </div>

        <input
          value={item.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          maxLength={RX_LIMITS.notes}
          placeholder={t("rx.notePlaceholder")}
          className={cn(inputCls, "text-xs")}
        />
      </div>
    </div>
  );
}
