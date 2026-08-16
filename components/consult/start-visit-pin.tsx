"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, Delete, KeyRound, Loader2, X } from "lucide-react";
import { useActions, useConsultRequests } from "@/lib/hooks/data";
import { useCurrentProvider } from "@/lib/hooks/use-current-doctor";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n";
import { awaitingStartCode, MAX_START_CODE_ATTEMPTS } from "@/lib/scheduling/trip";
import { cn } from "@/lib/utils/cn";
import type { ConsultRequest } from "@/lib/types/domain";

/**
 * "Enter the code", pinned — the provider's half of the arrival handshake.
 *
 * The mirror of the patient's ArrivalCodePin: they hold four digits up, this is
 * where those digits go. It lives above the dock from the moment the code is
 * due, because the alternative is what it replaces — a keypad buried inside one
 * card on one screen, which a provider standing on a doorstep has to go and
 * find.
 *
 * Built for the two ends of the audience at once: the tap targets and the type
 * are sized for someone reading at arm's length without glasses, and the
 * on-screen keypad means it works the same whether or not a numeric keyboard
 * appears. Auto-submits on the fourth digit — nobody hunts for a Confirm button
 * on a doorstep.
 */
export function StartVisitPin() {
  const me = useCurrentProvider();
  const requests = useConsultRequests();
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const req = requests
    .filter((r) => r.doctorId === me?.id && r.status === "accepted" && awaitingStartCode(r))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  if (!req) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
        style={{ bottom: "calc(var(--chrome-dock) + 0.75rem)" }}
      >
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "pointer-events-auto flex items-center gap-3 rounded-full bg-terracotta py-2.5 pl-4 pr-3.5",
            "shadow-[0_12px_34px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.98]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]",
          )}
        >
          <KeyRound className="h-4 w-4 shrink-0 text-on-accent" />
          <span className="flex flex-col items-start leading-none text-on-accent">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
              {req.patientName}
            </span>
            <span className="mt-1 text-sm font-bold">{t("pin.startVisit")}</span>
          </span>
          <ChevronUp className="h-4 w-4 shrink-0 text-on-accent/80" />
        </button>
      </div>
      {open && <Keypad req={req} onClose={() => setOpen(false)} />}
    </>
  );
}

function Keypad({ req, onClose }: { req: ConsultRequest; onClose: () => void }) {
  const { t } = useT();
  const { verifyStartCode } = useActions();
  const toast = useToast();
  const [digits, setDigits] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const locked = (req.startCodeAttempts ?? 0) >= MAX_START_CODE_ATTEMPTS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (/^\d$/.test(e.key)) return push(e.key);
      if (e.key === "Backspace") return back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const code = digits.join("");

  useEffect(() => {
    if (code.length === 4 && !submitted.current) {
      submitted.current = true;
      void submit(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function push(d: string) {
    setError(null);
    setDigits((prev) => (prev.length >= 4 ? prev : [...prev, d]));
  }
  function back() {
    setError(null);
    setDigits((prev) => prev.slice(0, -1));
  }

  async function submit(value: string) {
    setBusy(true);
    setError(null);
    try {
      await verifyStartCode(req.id, value);
      toast.push({ tone: "success", title: t("code.confirmed"), desc: t("code.confirmedDesc") });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("code.wrong"));
      setDigits([]);
      submitted.current = false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      // Bottom padding clears the floating dock: without it the last keypad row
      // (0 and delete) sits behind it and cannot be tapped at all.
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 px-3 pb-[calc(var(--chrome-dock)+0.75rem)] pt-3 backdrop-blur-sm sm:items-center sm:pb-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("code.doctorTitle")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-sm rounded-3xl border border-[var(--border)] bg-espresso-800 p-5 shadow-[var(--elev-shadow-strong)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-tan">
              <KeyRound className="h-3.5 w-3.5" /> {t("code.doctorTitle")}
            </p>
            <h2 className="mt-1.5 font-serif text-xl leading-tight text-cream">
              {t("pin.askFor", { name: req.patientName })}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Four slots, filled left to right. Read-only display: the keypad
            below is the only way in, so there is never a hidden focus state to
            hunt for, the commonest way an OTP field fails an older user. */}
        <div className="mt-5 flex justify-center gap-2.5" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "grid h-[4.5rem] w-14 place-items-center rounded-2xl border font-mono text-[2.5rem] font-bold leading-none",
                digits[i]
                  ? "border-terracotta/60 bg-espresso text-cream"
                  : "border-[var(--border)] bg-espresso text-[var(--text-faint)]",
                busy && "opacity-60",
              )}
            >
              {digits[i] ?? "·"}
            </span>
          ))}
        </div>

        {busy && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("common.loading")}
          </p>
        )}
        {error && !busy && (
          <p className="mt-3 text-center text-sm text-status-critical">{error}</p>
        )}
        {locked && !error && (
          <p className="mt-3 text-center text-xs text-status-critical">{t("pin.locked")}</p>
        )}

        {/* An explicit keypad rather than a text input: big, unambiguous targets
            that behave identically on a phone, a tablet and a laptop. */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Key key={d} onClick={() => push(d)} disabled={busy}>
              {d}
            </Key>
          ))}
          <Key onClick={onClose} disabled={busy} muted>
            <span className="text-sm font-semibold">{t("common.cancel")}</span>
          </Key>
          <Key onClick={() => push("0")} disabled={busy}>
            0
          </Key>
          <Key onClick={back} disabled={busy} muted aria-label={t("pin.delete")}>
            <Delete className="h-5 w-5" />
          </Key>
        </div>
      </div>
    </div>
  );
}

function Key({
  children,
  onClick,
  disabled,
  muted,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  muted?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // 3.75rem clears the 44px minimum touch target comfortably.
        "grid h-[3.75rem] place-items-center rounded-2xl border text-2xl font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]",
        muted
          ? "border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5"
          : "border-[var(--border)] bg-espresso text-cream hover:border-terracotta/50 active:scale-[0.97]",
        disabled && "opacity-50",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
