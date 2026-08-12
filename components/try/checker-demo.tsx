"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
 * The symptom checker, free for two runs.
 *
 * ── On the limit ──
 *
 * The count lives in localStorage, and localStorage is trivially cleared. That
 * is a deliberate choice, not an oversight: this is a funnel, not a paywall,
 * and treating it as a security boundary would mean fingerprinting people who
 * came here worried about a symptom. The server's own IP rate limit on
 * /api/diagnose is what actually stops abuse. Someone determined to get a
 * third free run can have it — they were never the reason for the limit.
 *
 * ── On what the preview withholds ──
 *
 * Not the answer. The full conclusion is shown, because a half-answer to
 * "should I worry about this" is worse than none. What sign-up adds is real:
 * the check is personalised against your history, it is saved so you can show
 * a doctor what you answered, and it turns into a booking with the right
 * specialty. Those are the things an account is genuinely required for.
 */

const STORAGE_KEY = "doceeto.try.checker.runs";
const FREE_RUNS = 2;

const URGENCY_COPY: Record<Urgency, { label: string; tone: string }> = {
  emergency: { label: "Emergency", tone: "text-status-critical" },
  urgent: { label: "See someone today", tone: "text-tan" },
  routine: { label: "Routine", tone: "text-status-ok" },
};

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

export function CheckerDemo() {
  const [runsUsed, setRunsUsed] = useState<number | null>(null);
  const [state, setState] = useState<DState>(() => initState(""));
  const [step, setStep] = useState<DStep | null>(null);
  const [seed, setSeed] = useState("");
  const [thinking, setThinking] = useState(false);
  const [started, setStarted] = useState(false);

  // Read the counter after mount — touching localStorage during render would
  // make the server and client markup disagree and blow up hydration.
  useEffect(() => {
    const raw = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
    setRunsUsed(Number.isFinite(raw) ? raw : 0);
  }, []);

  const locked = runsUsed !== null && runsUsed >= FREE_RUNS;
  const remaining = runsUsed === null ? FREE_RUNS : Math.max(0, FREE_RUNS - runsUsed);

  /** Ask the server for the next step, falling back to the offline engine. */
  async function advance(next: DState) {
    setThinking(true);
    const offline = () => setStep(nextStep(next));
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: next.seed,
          answers: next.answers.map((a) => ({ prompt: a.prompt, label: a.label })),
          history: [],
        }),
      });
      // 429 is the server's own ceiling. The offline engine still answers, so
      // a rate-limited visitor gets a result rather than a dead screen.
      const data = res.ok ? await res.json() : null;
      if (data?.step) setStep(fromAiStep(data.step));
      else offline();
    } catch {
      offline();
    } finally {
      setThinking(false);
    }
  }

  function begin(text: string) {
    const trimmed = text.trim();
    if (!trimmed || locked) return;
    const next = applyText(initState(trimmed), trimmed);
    setState(next);
    setStarted(true);
    void advance(next);
  }

  function answer(question: DQuestion, option: DOption) {
    const next = applyAiAnswer(state, question, option);
    setState(next);
    // Six questions is the engine's own ceiling; past it, conclude rather than
    // letting a chatty model keep asking forever.
    if (next.answers.length >= 6) {
      setStep(forceConclusion(next));
      return;
    }
    void advance(next);
  }

  /** Spend a run — counted when a check REACHES A CONCLUSION, not when it starts. */
  useEffect(() => {
    if (step?.kind !== "conclusion" || runsUsed === null) return;
    const used = runsUsed + 1;
    setRunsUsed(used);
    window.localStorage.setItem(STORAGE_KEY, String(used));
    // Intentionally keyed on the step identity only: re-running on `runsUsed`
    // would count the same conclusion twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function reset() {
    setState(initState(""));
    setStep(null);
    setSeed("");
    setStarted(false);
  }

  if (runsUsed === null) {
    return (
      <div className="grid place-items-center py-16 text-[var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (locked && step?.kind !== "conclusion") {
    return <Wall />;
  }

  return (
    <div className="space-y-4">
      {!started && (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Sparkles className="h-4 w-4 text-terracotta" />
            <p className="text-xs">
              {remaining} free {remaining === 1 ? "check" : "checks"} left · no account needed
            </p>
          </div>

          <label
            htmlFor="symptoms"
            className="mt-4 block font-serif text-xl text-[var(--text)]"
          >
            What&apos;s bothering you?
          </label>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Describe it the way you&apos;d tell a friend. A few words is enough.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              begin(seed);
            }}
            className="mt-4 flex gap-2"
          >
            <input
              id="symptoms"
              value={seed}
              onChange={(e) => setSeed(e.target.value.slice(0, 300))}
              placeholder="Headache and fever since yesterday"
              className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta"
            />
            <Button type="submit" disabled={!seed.trim()}>
              <Send className="h-4 w-4" />
              Start
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {["Sore throat for 3 days", "Lower back pain", "Rash on my arm", "Child with fever"].map(
              (example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => begin(example)}
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-terracotta hover:text-[var(--text)]"
                >
                  {example}
                </button>
              ),
            )}
          </div>
        </Card>
      )}

      {started && thinking && (
        <Card className="flex items-center gap-3 p-5 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin text-terracotta" />
          Thinking it through…
        </Card>
      )}

      {started && !thinking && step?.kind === "question" && (
        <Card className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Question {state.answers.length + 1} of up to 6
          </p>
          <p className="mt-2 font-serif text-xl text-[var(--text)]">{step.question.prompt}</p>
          {step.question.hint && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{step.question.hint}</p>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {step.question.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => answer(step.question, option)}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-3 text-left text-sm text-[var(--text)] transition-colors hover:border-terracotta hover:bg-[var(--surface)]"
              >
                {option.emoji && <span aria-hidden>{option.emoji}</span>}
                {option.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {step?.kind === "conclusion" && <Conclusion step={step} onReset={reset} locked={locked} />}
    </div>
  );
}

function Conclusion({
  step,
  onReset,
  locked,
}: {
  step: DConclusion;
  onReset: () => void;
  locked: boolean;
}) {
  const urgency = URGENCY_COPY[step.urgency];
  const causes = useMemo(() => step.causes?.slice(0, 3) ?? [], [step.causes]);

  return (
    <div className="space-y-4">
      {step.emergency && (
        <Card className="flex items-start gap-3 border-status-critical/40 bg-status-critical/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              What you described needs emergency care
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Call 112 or go to the nearest emergency department now. Don&apos;t wait for an
              appointment.
            </p>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            What this points to
          </p>
          <span className={cn("text-xs font-semibold", urgency.tone)}>{urgency.label}</span>
        </div>

        <p className="mt-2 font-serif text-2xl text-[var(--text)]">{step.specialty}</p>
        {step.summary && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{step.summary}</p>
        )}

        {causes.length > 0 && (
          <ul className="mt-4 space-y-2">
            {causes.map((cause) => (
              <li
                key={cause.name}
                className="rounded-lg border border-[var(--border)] px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--text)]">{cause.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                    {cause.likelihood.replace("-", " ")}
                  </span>
                </div>
                {cause.why && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{cause.why}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {step.advice && (
          <p className="mt-4 border-t border-[var(--border)] pt-4 text-sm text-[var(--text-muted)]">
            {step.advice}
          </p>
        )}

        {/* Stated on every result, not buried in a footer. This is a triage
            aid; it does not diagnose, and saying so is part of the answer. */}
        <p className="mt-3 text-[11px] text-[var(--text-faint)]">
          This is guidance, not a diagnosis. Only a doctor who examines you can give you one.
        </p>
      </Card>

      <Card className="p-5">
        <p className="font-serif text-lg text-[var(--text)]">
          {locked ? "That was your second free check" : "Turn this into an appointment"}
        </p>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          With an account this check is saved so you can show a doctor exactly what you answered,
          it&apos;s personalised against your history and medication, and it books you a{" "}
          {step.specialty.toLowerCase()} in one tap.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/signup">
            <Button>
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/login?next=${encodeURIComponent("/patient/care")}`}>
            <Button variant="outline">Log in</Button>
          </Link>
          {!locked && (
            <Button variant="ghost" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
              Check something else
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Wall() {
  return (
    <Card className="p-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--surface)] text-[var(--text-muted)]">
        <Lock className="h-5 w-5" />
      </span>
      <p className="mt-4 font-serif text-2xl text-[var(--text)]">
        You&apos;ve used both free checks
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
        Create an account for unlimited checks that remember your history, save every result, and
        connect straight to a doctor who can act on them.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/signup">
          <Button>
            Create an account
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/login?next=${encodeURIComponent("/patient/care")}`}>
          <Button variant="outline">Log in</Button>
        </Link>
        <Link href="/try/urgent">
          <Button variant="ghost">
            <Stethoscope className="h-4 w-4" />
            See doctors free now
          </Button>
        </Link>
      </div>
    </Card>
  );
}
