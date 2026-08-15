"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CornerDownLeft,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
  Stethoscope,
  Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useT } from "@/lib/i18n";
import {
  applyAiAnswer,
  applyText,
  forceConclusion,
  initState,
  nextStep,
  type DConclusion,
  type DOption,
  type DQuestion,
  type DState,
  type DStep,
  type Urgency,
} from "@/lib/diagnose/engine";
import { cn } from "@/lib/utils/cn";

/**
 * The symptom checker, free for two runs — as a conversation.
 *
 * ── Why a chat and not a form ──
 *
 * The old version put one question on screen at a time and threw the previous
 * one away, which meant you could not see what you had already said, could not
 * correct it, and could ONLY answer with the chips offered. A person describing
 * a symptom rarely fits the options: "sort of both", "it moved", "only when I
 * breathe in". A transcript keeps the whole exchange visible and — more
 * importantly — free text is accepted at EVERY step, not just the first.
 *
 * ── Never dead-end ──
 *
 * Every path reaches an answer. Typing something unmatched still advances
 * (applyText folds it through triage), every question carries an escape
 * ("Not sure" / "Something else"), "Get my result" concludes on demand, six
 * questions is a hard ceiling, and a network or rate-limit failure falls back
 * to the offline engine. There is no combination of inputs that leaves someone
 * staring at a screen with nothing to press.
 *
 * ── On the limit ──
 *
 * The count lives in localStorage, and localStorage is trivially cleared. That
 * is deliberate: this is a funnel, not a paywall, and treating it as a security
 * boundary would mean fingerprinting people who came here worried about a
 * symptom. The server's IP rate limit on /api/diagnose is the real ceiling.
 */

const STORAGE_KEY = "doceeto.try.checker.runs";
const FREE_RUNS = 2;
const MAX_QUESTIONS = 6;

/** Tone is fixed; the label is looked up per language at render time. */
const URGENCY_TONE: Record<Urgency, string> = {
  emergency: "text-status-critical",
  urgent: "text-tan",
  routine: "text-status-ok",
};

const URGENCY_KEY: Record<Urgency, string> = {
  emergency: "checker.urgencyEmergency",
  urgent: "checker.urgencyUrgent",
  routine: "checker.urgencyRoutine",
};

/** "less-likely" → the translated chip beside a cause. */
const LIKELIHOOD_KEY: Record<string, string> = {
  likely: "checker.likely",
  possible: "checker.possible",
  "less-likely": "checker.lessLikely",
};

type Msg =
  | { id: string; from: "bot"; text: string; hint?: string }
  | { id: string; from: "me"; text: string };

let msgSeq = 0;
const mkId = () => `m${++msgSeq}`;

/** The AI route answers in loose JSON; narrow it before it reaches the engine. */
function fromAiStep(s: Record<string, unknown>): DStep {
  if (s.kind === "question") {
    const options = (s.options as Record<string, unknown>[]) ?? [];
    return {
      kind: "question",
      question: {
        id: String(s.id ?? "ai"),
        prompt: String(s.prompt ?? ""),
        hint: s.hint ? String(s.hint) : undefined,
        options: options.map((o, i) => ({
          value: String(o.value ?? `opt-${i}`),
          label: String(o.label ?? "Option"),
          emoji: o.emoji ? String(o.emoji) : undefined,
        })),
      },
    };
  }
  const causes = (Array.isArray(s.causes) ? (s.causes as Record<string, unknown>[]) : []).map(
    (c) => ({
      name: String(c.name ?? "Possible cause"),
      likelihood: (c.likelihood as "likely" | "possible" | "less-likely") ?? "possible",
      why: c.why ? String(c.why) : undefined,
      specialty: String(c.specialty ?? "General Physician") as DConclusion["specialty"],
    }),
  );
  return {
    kind: "conclusion",
    urgency: (s.urgency as Urgency) ?? "routine",
    specialty: String(s.specialty ?? "General Physician") as DConclusion["specialty"],
    conditions: Array.isArray(s.conditions) ? (s.conditions as string[]) : [],
    advice: String(s.advice ?? ""),
    summary: s.summary ? String(s.summary) : undefined,
    emergency: (s.urgency as Urgency) === "emergency",
    causes,
  };
}

/** The page heading above the card, translated. */
export function CheckerPageHeader() {
  const { t } = useT();
  return <PageHeader label={t("checker.pageLabel")} title={t("checker.pageTitle")} />;
}

export function CheckerDemo() {
  const { t, lang } = useT();
  const [runsUsed, setRunsUsed] = useState<number | null>(null);
  const [state, setState] = useState<DState>(() => initState(""));
  const [step, setStep] = useState<DStep | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: mkId(), from: "bot", text: "" }]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [started, setStarted] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
    setRunsUsed(Number.isFinite(raw) ? raw : 0);
  }, []);

  /**
   * Keep the greeting in the current language — and only the greeting.
   *
   * Language is chosen from inside the chat, so the common case is someone
   * reading the English opener, realising they'd rather answer in Marathi, and
   * switching. Re-rendering the opener means they never see the switch fail to
   * do anything. Once the conversation has STARTED this stops: a transcript is
   * a record of what was actually said, and silently rewriting the user's own
   * words (or a question they already answered) in another language would make
   * it a fiction. From then on only NEW turns arrive translated, which is what
   * the model is now being told to do.
   */
  useEffect(() => {
    if (started) return;
    setMsgs([{ id: mkId(), from: "bot", text: t("checker.opener") }]);
  }, [lang, started, t]);

  // Keep the newest message in view. Chat that grows off-screen silently is
  // worse than no chat — you cannot tell it responded.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking, step]);

  const locked = runsUsed !== null && runsUsed >= FREE_RUNS;
  const remaining = runsUsed === null ? FREE_RUNS : Math.max(0, FREE_RUNS - runsUsed);
  const done = step?.kind === "conclusion";
  const asked = state.answers.length;

  const say = (m: Msg) => setMsgs((prev) => [...prev, m]);

  function present(next: DStep) {
    setStep(next);
    if (next.kind === "question") {
      say({
        id: mkId(),
        from: "bot",
        text: next.question.prompt,
        hint: next.question.hint,
      });
    }
  }

  /** Ask the server for the next step, falling back to the offline engine. */
  async function advance(next: DState) {
    setThinking(true);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: next.seed,
          answers: next.answers.map((a) => ({ prompt: a.prompt, label: a.label })),
          history: [],
          // What the questions, options and the differential come back in.
          lang,
        }),
      });
      // 429 is the server's own ceiling. The offline engine still answers, so a
      // rate-limited visitor gets a result rather than a dead screen.
      const data = res.ok ? await res.json() : null;
      present(data?.step ? fromAiStep(data.step) : nextStep(next));
    } catch {
      present(nextStep(next));
    } finally {
      setThinking(false);
    }
  }

  /** Advance, or conclude if we've hit a ceiling or tripped a red flag. */
  function proceed(next: DState) {
    setState(next);
    // A red flag anywhere in the conversation ends it immediately. Continuing
    // to ask about sleep quality after someone types "crushing chest pain" is
    // the one failure this tool must never have.
    if (next.flags.length > 0) {
      setStep(forceConclusion(next));
      return;
    }
    if (next.answers.length >= MAX_QUESTIONS) {
      setStep(forceConclusion(next));
      return;
    }
    void advance(next);
  }

  /** Free text — the seed, or an answer that didn't fit the chips. */
  function send(raw: string) {
    const text = raw.trim().slice(0, 300);
    if (!text || thinking || locked || done) return;
    setDraft("");
    say({ id: mkId(), from: "me", text });

    if (!started) {
      setStarted(true);
      proceed(applyText(initState(text), text));
      return;
    }
    proceed(applyText(state, text));
  }

  /** A chip on the current question. */
  function pick(question: DQuestion, option: DOption) {
    if (thinking || locked || done) return;
    say({ id: mkId(), from: "me", text: option.label });
    proceed(applyAiAnswer(state, question, option));
  }

  /** Conclude now with whatever we have. Always available once we know
   *  anything at all — nobody should be trapped in a questionnaire. */
  function finishNow() {
    if (!started || thinking || done) return;
    say({ id: mkId(), from: "me", text: t("checker.skipSaid") });
    setStep(forceConclusion(state));
  }

  /** Spend a run — counted when a check REACHES A CONCLUSION, not when it starts. */
  useEffect(() => {
    if (step?.kind !== "conclusion" || runsUsed === null) return;
    const used = runsUsed + 1;
    setRunsUsed(used);
    window.localStorage.setItem(STORAGE_KEY, String(used));
    // Keyed on step identity only: re-running on `runsUsed` would double-count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function reset() {
    setState(initState(""));
    setStep(null);
    setMsgs([{ id: mkId(), from: "bot", text: t("checker.opener") }]);
    setDraft("");
    setStarted(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (runsUsed === null) {
    return (
      <div className="grid place-items-center py-16 text-[var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (locked && !done) return <Wall t={t} />;

  const question = step?.kind === "question" ? step.question : null;

  return (
    // h-full, not a vh clamp: the layout has already worked out how much room
    // is left after the header, tabs and home button, so filling the slot is
    // correct at every window size. A fixed 72vh either overflowed a short
    // window or left a gap under a tall one.
    <Card className="flex h-full flex-col overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
            <Stethoscope className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[var(--text)]">{t("checker.title")}</p>
            <p className="text-[11px] text-[var(--text-faint)]">
              {done
                ? t("checker.done")
                : started
                  ? t("checker.answered", { a: String(asked), b: String(MAX_QUESTIONS) })
                  : remaining === 1
                    ? t("checker.freeLeftOne")
                    : t("checker.freeLeft", { n: String(remaining) })}
            </p>
          </div>
        </div>
        {/* The switcher lives IN the chat header, not in the page chrome.
            This is the one screen where the language choice changes what the
            product does rather than how it looks — pick Marathi and the
            questions, the options and the differential all arrive in Marathi —
            so it belongs beside the conversation it governs. */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSelector />
          {started && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <RotateCcw className="h-3 w-3" />
              {t("checker.restart")}
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      {/* min-h-0 lets this shrink below its content so the composer below is
          never pushed out of the card on a short window. */}
      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m) =>
          m.from === "bot" ? (
            <Bubble key={m.id} text={m.text} hint={m.hint} />
          ) : (
            <Mine key={m.id} text={m.text} />
          ),
        )}

        {thinking && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/10">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
            </span>
            {t("checker.thinking")}
          </div>
        )}

        {/* Option chips for the live question. Free text still works — these
            are a shortcut, never the only way to answer. */}
        {question && !thinking && !done && (
          <div className="ml-9 flex flex-wrap gap-1.5 pt-1">
            {question.options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(question, o)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {o.emoji && <span aria-hidden>{o.emoji}</span>}
                {o.label}
              </button>
            ))}
            {/* Escape hatches, on every question. Without these, anyone whose
                answer isn't on the list has to guess or abandon. */}
            <button
              type="button"
              onClick={() => pick(question, { value: "unsure", label: t("checker.notSure") })}
              className="rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              {t("checker.notSure")}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              {t("checker.somethingElse")}
            </button>
          </div>
        )}

        {done && step?.kind === "conclusion" && (
          <div className="pt-1">
            <Conclusion step={step} onReset={reset} locked={locked} t={t} lang={lang} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--border)] px-4 py-3">
        {!done ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 300))}
                disabled={thinking}
                placeholder={
                  started ? t("checker.placeholderAnswer") : t("checker.placeholder")
                }
                aria-label={t("checker.aria")}
                className="h-11 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] disabled:opacity-60"
              />
              <Button type="submit" disabled={!draft.trim() || thinking} className="rounded-full">
                <CornerDownLeft className="h-4 w-4" />
                {t("checker.send")}
              </Button>
            </form>

            {!started ? (
              // Suggestions are a nicety; on a short window the composer and
              // transcript matter more, so they drop out rather than compete.
              <div className="mt-2.5 hidden flex-wrap items-center gap-1.5 [@media(min-height:600px)]:flex">
                {/* Says out loud that typing in Hindi or Marathi works — the
                    switcher only changes the chrome until someone tries it. */}
                <span className="mr-0.5 text-[11px] text-[var(--text-faint)]">
                  {t("checker.langHint")}
                </span>
                {[
                  t("checker.ex1"),
                  t("checker.ex2"),
                  t("checker.ex3"),
                  t("checker.ex4"),
                ].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => send(ex)}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={finishNow}
                disabled={thinking}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-50"
              >
                <Wand2 className="h-3 w-3" />
                {t("checker.skip")}
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            {t("checker.guidanceOnly")}
          </div>
        )}
      </div>
    </Card>
  );
}

function Bubble({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
        <Stethoscope className="h-3.5 w-3.5" />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <p className="text-sm leading-relaxed text-[var(--text)]">{text}</p>
        {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    </div>
  );
}

function Mine({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--accent)] px-3.5 py-2.5">
        <p className="text-sm leading-relaxed text-on-accent">{text}</p>
      </div>
    </div>
  );
}

type T = (key: string, vars?: Record<string, string>) => string;

/** Any Devanagari at all — good enough to tell AI copy from engine copy. */
const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Translate a string the DETERMINISTIC engine produced, if we can.
 *
 * The offline engine returns English whatever language the patient chose, so
 * a fallback answer arrives as English clinical text inside otherwise Marathi
 * chrome. Red-flag names are a closed set, so they get a real translation; the
 * check below is what keeps this from touching the AI's output, which is
 * already in the right language and must pass through untouched.
 */
function engineText(t: T, lang: string, s: string | undefined, fallbackKey?: string): string {
  if (!s) return "";
  if (lang === "en" || DEVANAGARI.test(s)) return s;
  const keyed = t(`flag.${s}`);
  if (keyed !== `flag.${s}`) return keyed;
  // The engine's generic, non-red-flag stock phrases.
  const generic = t(`eng.${s}`);
  if (generic !== `eng.${s}`) return generic;
  return fallbackKey ? t(fallbackKey) : s;
}

function Conclusion({
  step,
  onReset,
  locked,
  t,
  lang,
}: {
  step: DConclusion;
  onReset: () => void;
  locked: boolean;
  t: T;
  lang: string;
}) {
  const causes = useMemo(() => step.causes?.slice(0, 3) ?? [], [step.causes]);
  // Emergency copy has its own fallback keys — that is the case where leaving
  // English on screen is not acceptable.
  const summary = engineText(
    t,
    lang,
    step.summary,
    step.emergency ? "checker.offlineEmergencySummary" : undefined,
  );
  const advice = engineText(
    t,
    lang,
    step.advice,
    step.emergency ? "checker.offlineEmergencyAdvice" : undefined,
  );

  return (
    <div className="space-y-3">
      {step.emergency && (
        <div className="flex items-start gap-3 rounded-card border border-status-critical/40 bg-status-critical/5 p-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              {t("checker.emergencyTitle")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {t("checker.emergencyDesc")}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            {t("checker.pointsTo")}
          </p>
          <span className={cn("text-xs font-semibold", URGENCY_TONE[step.urgency])}>
            {t(URGENCY_KEY[step.urgency])}
          </span>
        </div>

        <p className="mt-1.5 font-serif text-2xl text-[var(--text)]">{step.specialty}</p>
        {summary && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{summary}</p>
        )}

        {causes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {causes.map((cause) => (
              <li key={cause.name} className="rounded-lg border border-[var(--border)] px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--text)]">
                    {engineText(t, lang, cause.name)}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                    {LIKELIHOOD_KEY[cause.likelihood]
                      ? t(LIKELIHOOD_KEY[cause.likelihood])
                      : cause.likelihood.replace("-", " ")}
                  </span>
                </div>
                {cause.why && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {engineText(
                      t,
                      lang,
                      cause.why,
                      step.emergency ? "checker.offlineEmergencyWhy" : undefined,
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {advice && (
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-[var(--text-muted)]">
            {advice}
          </p>
        )}

        <p className="mt-2.5 text-[11px] text-[var(--text-faint)]">
          {t("checker.notDiagnosis")}
        </p>
      </div>

      <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="font-serif text-lg text-[var(--text)]">
          {locked ? t("checker.secondFree") : t("checker.turnIntoAppt")}
        </p>
        {/* The specialty name is an English key (it routes a booking), so the
            sentence is written NOT to inline it — a Hindi sentence with
            "Cardiologist" dropped into the middle reads worse than one that
            simply says "the right doctor". The card above already names it. */}
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("checker.upsell")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/signup">
            <Button>
              {t("checker.createAccount")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/login?next=${encodeURIComponent("/patient/care")}`}>
            <Button variant="outline">{t("checker.logIn")}</Button>
          </Link>
          {!locked && (
            <Button variant="ghost" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
              {t("checker.checkAnother")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Wall({ t }: { t: T }) {
  return (
    <Card className="p-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--surface)] text-[var(--text-muted)]">
        <Lock className="h-5 w-5" />
      </span>
      <p className="mt-4 font-serif text-2xl text-[var(--text)]">{t("checker.wallTitle")}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
        {t("checker.wallDesc")}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/signup">
          <Button>
            {t("checker.createAccount")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/login?next=${encodeURIComponent("/patient/care")}`}>
          <Button variant="outline">{t("checker.logIn")}</Button>
        </Link>
        <Link href="/try/urgent">
          <Button variant="ghost">
            <Stethoscope className="h-4 w-4" />
            {t("checker.seeDoctors")}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
