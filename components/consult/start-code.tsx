"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import { MAX_START_CODE_ATTEMPTS } from "@/lib/scheduling/trip";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import type { ConsultRequest } from "@/lib/types/domain";

/**
 * The arrival handshake, ride-hailing style.
 *
 * The patient's screen shows four digits. The doctor, face to face (or on the
 * video call), types what the patient reads out. Getting it right is
 * simultaneous proof that the doctor turned up, the patient was there, and
 * treatment actually began — and it stamps when.
 *
 * The digits never travel to the doctor's device: /api/data strips them for
 * every reader but the patient, so the only channel is the patient's voice.
 */

// ── Patient side: show the code ──────────────────────────────

export function StartCodeForPatient({ req }: { req: ConsultRequest }) {
  const { startConsultAsPatient, reissueStartCode } = useActions();
  const toast = useToast();
  const { t } = useT();
  const [busy, setBusy] = useState<"start" | "reissue" | null>(null);

  const code = req.startCode ?? undefined;
  const locked = (req.startCodeAttempts ?? 0) >= MAX_START_CODE_ATTEMPTS;

  async function run(kind: "start" | "reissue") {
    setBusy(kind);
    try {
      if (kind === "start") {
        await startConsultAsPatient(req.id);
        toast.push({ tone: "success", title: t("code.started") });
      } else {
        await reissueStartCode(req.id);
        toast.push({ tone: "info", title: t("code.newIssued") });
      }
    } catch (e) {
      toast.push({
        tone: "error",
        title: t("common.retry"),
        desc: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-terracotta/40 bg-terracotta/[0.07] p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-salmon">
        <KeyRound className="h-3.5 w-3.5" /> {t("code.title")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
        {t("code.patientHint")}
      </p>

      {/* The digits, spaced so they're easy to read out loud. */}
      <div className="mt-3 flex justify-center gap-2" aria-label={t("code.title")}>
        {(code ?? "····").split("").map((d, i) => (
          <span
            key={i}
            className="grid h-14 w-11 place-items-center rounded-xl border border-terracotta/30 bg-espresso-800 font-mono text-2xl font-bold text-cream"
          >
            {d}
          </span>
        ))}
      </div>

      {locked && (
        <p className="mt-2.5 text-center text-xs text-status-critical">
          {t("code.lockedPatient")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => run("start")}
          disabled={busy !== null}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "start" ? t("common.loading") : t("code.startMyself")}
        </button>
        <button
          onClick={() => run("reissue")}
          disabled={busy !== null}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-white/5 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", busy === "reissue" && "animate-spin")} />
          {t("code.newCode")}
        </button>
      </div>
    </div>
  );
}

// ── Doctor side: enter the code ──────────────────────────────

export function StartCodeForDoctor({ req }: { req: ConsultRequest }) {
  const { verifyStartCode } = useActions();
  const toast = useToast();
  const { t } = useT();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  // Submit itself the moment the fourth digit lands — one less tap while
  // standing in someone's doorway.
  useEffect(() => {
    if (code.length === 4 && !busy) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function put(i: number, value: string) {
    const v = value.replace(/\D/g, "");
    if (!v) {
      setDigits((d) => d.map((x, j) => (j === i ? "" : x)));
      return;
    }
    setError(null);
    // Handles a paste of the whole code as well as a single keypress.
    setDigits((d) => {
      const next = [...d];
      for (let k = 0; k < v.length && i + k < 4; k++) next[i + k] = v[k];
      return next;
    });
    boxes.current[Math.min(3, i + v.length)]?.focus();
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await verifyStartCode(req.id, code);
      toast.push({ tone: "success", title: t("code.confirmed"), desc: t("code.confirmedDesc") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("code.wrong");
      setError(msg);
      setDigits(["", "", "", ""]);
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-tan/30 bg-tan/10 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-tan">
        <ShieldCheck className="h-3.5 w-3.5" /> {t("code.doctorTitle")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
        {t("code.doctorHint", { name: req.patientName })}
      </p>

      <div className="mt-3 flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            value={d}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => {
              // Backspace on an empty box steps back, like every OTP field.
              if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            disabled={busy}
            aria-label={`${t("code.digit")} ${i + 1}`}
            className="h-14 w-11 rounded-xl border border-[var(--border)] bg-espresso-800 text-center font-mono text-2xl font-bold text-cream outline-none transition-colors focus:border-terracotta focus:ring-1 focus:ring-terracotta/40 disabled:opacity-60"
          />
        ))}
      </div>

      {busy && (
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("common.loading")}
        </p>
      )}
      {error && !busy && (
        <p className="mt-2.5 text-center text-xs text-status-critical">{error}</p>
      )}
    </div>
  );
}
