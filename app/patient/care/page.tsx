"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Send,
  Plus,
  Menu,
  X,
  Stethoscope,
  FileText,
  CalendarClock,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  History,
  Thermometer,
  HeartPulse,
  Bone,
  Hand,
  Brain,
  Baby,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { useConsultRequests } from "@/lib/hooks/data";
import {
  useMedicalHistory,
  type CheckSession,
} from "@/lib/hooks/use-medical-history";
import { useT } from "@/lib/i18n";
import {
  initState,
  applyAnswer,
  applyAiAnswer,
  applyText,
  nextStep,
  forceConclusion,
  type DState,
  type DStep,
  type DConclusion,
  type DOption,
  type DCause,
  type Urgency,
} from "@/lib/diagnose/engine";
import { cn } from "@/lib/utils/cn";

export default function CarePage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">
          Loading…
        </div>
      }
    >
      <CareInner />
    </Suspense>
  );
}

function urgencyTone(u: string) {
  if (u === "emergency") return "bg-status-critical/15 text-status-critical";
  if (u === "urgent") return "bg-tan/15 text-tan";
  return "bg-status-ok/15 text-status-ok";
}

function likelihoodTone(l: DCause["likelihood"]) {
  if (l === "likely")
    return "bg-[rgb(var(--c-terracotta))]/15 text-[rgb(var(--c-terracotta))]";
  if (l === "possible")
    return "bg-[rgb(var(--c-tan))]/15 text-[rgb(var(--c-tan))]";
  return "fh-tile text-[var(--text-faint)]";
}

/** "less-likely" would read as a dismissal on a chip; soften the wording
 *  without softening the ranking. */
function likelihoodLabel(l: DCause["likelihood"]) {
  if (l === "likely") return "Most likely";
  if (l === "possible") return "Possible";
  return "Worth ruling out";
}

/** Normalise a raw AI step into our DStep shape. */
function fromAiStep(s: Record<string, unknown>): DStep {
  if (s.kind === "question") {
    const opts = (s.options as Array<Record<string, unknown>>) ?? [];
    return {
      kind: "question",
      question: {
        id: String(s.id ?? "ai"),
        prompt: String(s.prompt ?? ""),
        hint: s.hint ? String(s.hint) : undefined,
        options: opts.map((o, i) => ({
          value: String(o.value ?? `opt-${i}`),
          label: String(o.label ?? "Option"),
          emoji: o.emoji ? String(o.emoji) : undefined,
        })),
      },
    };
  }
  const conditions = Array.isArray(s.conditions)
    ? (s.conditions as string[])
    : [];
  const urgency = (s.urgency as Urgency) ?? "routine";
  const causes: DCause[] = (
    Array.isArray(s.causes) ? (s.causes as Record<string, unknown>[]) : []
  ).map((c) => ({
    name: String(c.name ?? "Possible cause"),
    likelihood: (c.likelihood as DCause["likelihood"]) ?? "possible",
    why: c.why ? String(c.why) : undefined,
    specialty: String(
      c.specialty ?? "General Physician",
    ) as DConclusion["specialty"],
  }));
  return {
    kind: "conclusion",
    urgency,
    specialty: String(
      s.specialty ?? "General Physician",
    ) as DConclusion["specialty"],
    alt: s.alt ? (String(s.alt) as DConclusion["specialty"]) : undefined,
    conditions: conditions.length
      ? conditions
      : causes.length
        ? causes.map((c) => c.name)
        : ["General consultation"],
    summary: s.summary ? String(s.summary) : undefined,
    causes,
    alsoSee: (Array.isArray(s.alsoSee)
      ? (s.alsoSee as string[])
      : []) as DConclusion["alsoSee"],
    advice: String(
      s.advice ??
        "A doctor is a good fit for this. Book whenever you're ready.",
    ),
    emergency: Boolean(s.emergency) || urgency === "emergency",
  };
}

function CareInner() {
  const { patient } = useCurrentPatient();
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const seed = params.get("q") ?? "";

  const { sessions, saveSession, recentConditions } = useMedicalHistory();
  const requests = useConsultRequests();

  const [state, setState] = useState<DState>(() =>
    initState(seed, recentConditions()),
  );
  const [step, setStep] = useState<DStep | null>(null);
  const [thinking, setThinking] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // ?history=1 deep-links straight into the past-chats drawer — it's where
  // "See all" on the home screen's health history lands.
  const [drawerOpen, setDrawerOpen] = useState(params.get("history") === "1");
  const [viewed, setViewed] = useState<CheckSession | null>(null);
  const sessionId = useRef(`care-${Date.now().toString(36)}`);
  /** Whether the AI has driven any turn this session — decides how we recover
   *  when it drops out (resume the local funnel vs. wrap up). */
  const aiDrove = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRef2 = useRef<HTMLDivElement>(null);

  const conclusion = step?.kind === "conclusion" ? step : null;
  const firstName = patient.name.split(" ")[0] || "there";
  const greetKey =
    new Date().getHours() < 12
      ? "greeting.morning"
      : new Date().getHours() < 17
        ? "greeting.afternoon"
        : "greeting.evening";

  // Prefer the AI checker, fall back to the offline rule engine. Red-flag
  // emergencies short-circuit locally.
  useEffect(() => {
    if (viewed) return;
    let cancelled = false;
    const local = nextStep(state);
    if (state.flags.length > 0) {
      setStep(local);
      setAiOn(false);
      return;
    }
    setThinking(true);
    (async () => {
      /* When the AI drops out mid-session its questions leave no tags on the
         local state, so `nextStep` would hand back the funnel's very first
         question — the patient would be asked to screen for emergencies again
         after five AI turns. Once we have enough to go on, wrap up instead. */
      const offline = () => {
        setStep(
          aiDrove.current && state.answers.length >= 3
            ? forceConclusion(state)
            : local,
        );
        setAiOn(false);
      };
      try {
        const res = await apiFetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed: state.seed,
            answers: state.answers.map((a) => ({
              prompt: a.prompt,
              label: a.label,
            })),
            history: recentConditions(),
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data?.step) {
          aiDrove.current = true;
          setStep(fromAiStep(data.step));
          setAiModel(typeof data.model === "string" ? data.model : null);
          setAiOn(true);
        } else {
          offline();
        }
      } catch {
        if (!cancelled) offline();
      } finally {
        if (!cancelled) setThinking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, viewed]);

  // Persist the session as it grows / concludes.
  useEffect(() => {
    if (viewed) return;
    if (state.answers.length === 0 && !state.seed) return;
    const title =
      state.seed?.slice(0, 40) ||
      state.answers.find((a) => a.questionId === "area")?.label ||
      conclusion?.specialty ||
      "Symptom check";
    saveSession({
      id: sessionId.current,
      startedAt: Number(
        sessionId.current.split("-")[1]
          ? parseInt(sessionId.current.split("-")[1], 36)
          : Date.now(),
      ),
      title,
      seed: state.seed,
      answers: state.answers,
      conclusion,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, conclusion, viewed]);

  useEffect(() => {
    // Measure a frame later so the conclusion card is at its final height;
    // scrolling in the same tick under-shot and left its CTAs cut off
    // behind the composer.
    const id = requestAnimationFrame(() => {
      [scrollRef, scrollRef2].forEach((r) =>
        r.current?.scrollTo({
          top: r.current.scrollHeight,
          behavior: "smooth",
        }),
      );
    });
    return () => cancelAnimationFrame(id);
  }, [state.answers.length, step, thinking, viewed]);

  function newCheck() {
    sessionId.current = `care-${Date.now().toString(36)}`;
    aiDrove.current = false;
    setState(initState("", recentConditions()));
    setViewed(null);
    setDraft("");
    setDrawerOpen(false);
  }

  function pick(opt: { value: string; label: string }) {
    if (!step || step.kind !== "question") return;
    const q = step.question;
    const found = q.options.find((o) => o.value === opt.value);
    const dopt: DOption = found ?? { value: opt.value, label: opt.label };
    // applyAiAnswer, not applyAnswer: AI-written chips carry no scores or
    // red-flag data, so it runs the keyword triage over the label to keep the
    // emergency short-circuit and the offline fallback fed underneath.
    setState((s) => applyAiAnswer(s, q, dopt));
  }

  function sendText() {
    const text = draft.trim();
    if (!text) return;
    setState((s) => applyText(s, text));
    setDraft("");
  }

  const view = viewed ?? {
    seed: state.seed,
    answers: state.answers,
    conclusion,
  };
  const myBookings = requests.filter((r) => r.patientId === patient.id);
  const reports = myBookings.filter((r) => r.status === "completed");
  const activeConclusion = viewed ? view.conclusion : conclusion;
  const fresh = !view.seed && view.answers.length === 0 && !activeConclusion;

  return (
    <>
      <ChatSidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNew={newCheck}
        sessions={sessions}
        activeId={viewed?.id ?? sessionId.current}
        onOpenSession={(s) => {
          setViewed(s);
          setDrawerOpen(false);
        }}
        bookings={myBookings}
        reports={reports}
        t={t}
      />

      {/* ── Mobile / tablet — ChatGPT-style compose ── */}
      <div className="-mt-4 -mb-[calc(var(--chrome-dock)+1.75rem)] flex h-[calc(100dvh-var(--chrome-top)-var(--chrome-dock))] min-h-[480px] flex-col pt-4 lg:hidden">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full fh-card text-cream lg:hidden"
            aria-label="History"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <h1 className="text-base font-semibold text-cream">
              {t("care.title")}
            </h1>
            {aiOn && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                AI
              </span>
            )}
          </div>
          <button
            onClick={newCheck}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full fh-card text-cream"
            aria-label={t("chat.newChat")}
          >
            <Plus className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
          {fresh ? (
            <div className="flex h-full flex-col items-center justify-center px-2 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-cream">
                {t("care.title")}
              </h2>
              <p className="mt-1 max-w-xs text-sm text-[var(--text-muted)]">
                {t("care.subtitle")}
              </p>
            </div>
          ) : (
            <>
              <Bubble who="bot">{t("care.subtitle")}</Bubble>
              {view.seed ? <Bubble who="me">{view.seed}</Bubble> : null}
              {view.answers.map((a, i) =>
                a.questionId === "free" ? (
                  <Bubble key={i} who="me">
                    {a.label}
                  </Bubble>
                ) : (
                  <div key={i} className="space-y-3">
                    <Bubble who="bot">{a.prompt}</Bubble>
                    <Bubble who="me">{a.label}</Bubble>
                  </div>
                ),
              )}
            </>
          )}

          {!viewed && thinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md fh-tile px-4 py-3">
                <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
              </div>
            </div>
          )}

          {/* Current question + option rows (ChatGPT-style list) */}
          {!viewed && !thinking && step?.kind === "question" && (
            <div className="space-y-3">
              {!fresh && (
                <Bubble who="bot">
                  {step.question.prompt}
                  {step.question.hint ? (
                    <span className="mt-1 block text-xs text-[var(--text-faint)]">
                      {step.question.hint}
                    </span>
                  ) : null}
                </Bubble>
              )}
              {fresh && (
                <p className="px-1 pb-1 text-center text-[15px] font-medium text-cream">
                  {step.question.prompt}
                </p>
              )}
              <div className="space-y-2">
                {step.question.options.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => pick(o)}
                    className="group flex w-full items-center gap-3 rounded-2xl fh-tile px-3.5 py-3.5 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgb(var(--c-terracotta))]/12">
                      <span className="h-2 w-2 rounded-full bg-[rgb(var(--c-terracotta))]" />
                    </span>
                    <span className="flex-1 text-[15px] font-medium text-cream">
                      {o.label}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConclusion && (
            <ResultCard
              conclusion={activeConclusion}
              onBook={(spec) =>
                router.push(
                  `/patient/doctors?specialty=${encodeURIComponent(spec)}`,
                )
              }
              onRestart={newCheck}
              readOnly={!!viewed}
            />
          )}
        </div>

        {/* Composer — pill input (ChatGPT-style) */}
        {viewed ? (
          <button
            onClick={newCheck}
            className="mb-1 flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-on-accent"
          >
            <Plus className="h-4 w-4" /> New check
          </button>
        ) : (
          <div className="mb-1 flex items-center gap-2 rounded-full fh-card p-1.5">
            <button
              onClick={newCheck}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:text-cream"
              aria-label={t("chat.newChat")}
            >
              <Plus className="h-5 w-5" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              placeholder={t("chat.placeholder")}
              className="flex-1 bg-transparent px-1 py-2 text-[15px] text-cream outline-none placeholder:text-[var(--text-faint)]"
            />
            <button
              onClick={sendText}
              disabled={!draft.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-on-accent transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop — immersive symptom checker ── */}
      {/* The floor is sized by the shell's chrome vars so a short laptop
          window can't push the composer down under the dock; the transcript
          absorbs the loss since it scrolls. */}
      <div className="relative left-1/2 hidden h-[calc(100dvh-var(--chrome-top)-var(--chrome-dock))] min-h-[420px] w-screen -translate-x-1/2 flex-col overflow-hidden lg:-mb-[calc(var(--chrome-dock)+1.75rem)] lg:flex">
        {/* floating scene */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-[12%] top-[16%] h-56 w-56 animate-float rounded-full bg-[rgb(var(--c-terracotta))] opacity-10 blur-3xl" />
          <div
            className="absolute right-[14%] top-[28%] h-64 w-64 animate-float rounded-full bg-[rgb(var(--c-salmon))] opacity-[0.12] blur-3xl"
            style={{ animationDelay: "-3s" }}
          />
          <div
            className="absolute bottom-[8%] left-[42%] h-52 w-52 animate-float rounded-full bg-[rgb(var(--c-tan))] opacity-10 blur-3xl"
            style={{ animationDelay: "-6s" }}
          />
        </div>

        {/* top bar */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-10 flex items-center justify-between px-10 transition-all duration-300",
            fresh ? "pt-6" : "pt-0",
          )}
        >
          <div>
            {fresh ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  Symptom checker · Guided
                </p>

                <h1 className="mt-1 text-3xl font-bold tracking-tight text-cream">
                  {t(greetKey)},{" "}
                  <span className="text-[rgb(var(--c-terracotta))]">
                    {firstName}
                  </span>
                </h1>
              </>
            ) : (
              <h1 className="text-lg font-semibold tracking-tight text-cream">
                {t("care.title")}
              </h1>
            )}
          </div>

          <div
            title={aiModel ? `Model: ${aiModel}` : "Offline rule engine"}
            className={cn(
              "flex items-center gap-2 rounded-full fh-card px-3.5 py-2 text-xs font-medium text-[var(--text-muted)]",
              !fresh && "mt-[-2px]",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                aiOn ? "bg-status-ok" : "bg-[rgb(var(--c-tan))]",
              )}
            />
            {aiOn ? "AI ready" : "Guided mode"}
          </div>
        </div>

        {/* left rail — body areas */}
        <div className="absolute left-6 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2.5">
          {AREAS.map((a) => (
            <ImmersiveRail
              key={a.seed}
              icon={a.icon}
              title={a.title}
              onClick={() => {
                if (!thinking && !viewed) setState((s) => applyText(s, a.seed));
              }}
            />
          ))}
        </div>

        {/* right rail — actions */}
        <div className="absolute right-6 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2.5">
          <ImmersiveRail icon={Plus} title="New check" onClick={newCheck} />
          <ImmersiveRail
            icon={History}
            title="History"
            onClick={() => setDrawerOpen(true)}
          />
          <ImmersiveRail
            icon={FileText}
            title="Reports"
            onClick={() => setDrawerOpen(true)}
          />
          <ImmersiveRail
            icon={AlertTriangle}
            title="Emergency"
            onClick={() => router.push("/patient/now")}
          />
        </div>

        {/* Transcript + composer share one flex column. They used to be two
            absolutely-positioned blocks with a fixed gap between them, which
            the option chips outgrew as soon as they wrapped onto extra rows —
            the overflow then painted straight over the last message. As flex
            siblings the transcript simply gives up the height instead. The
            column is click-through so the side rails behind it stay usable. */}
        <div
          className={cn(
            "pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col pb-1",
            fresh ? "pt-24" : "pt-6",
          )}
        >
          <div
            ref={scrollRef2}
            className="pointer-events-auto mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6"
          >
            <div className="flex min-h-full flex-col justify-end gap-3 py-3">
              {fresh ? (
                <div className="flex flex-col items-center pb-6 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-3xl bg-primary/15 text-primary">
                    <Sparkles className="h-8 w-8" />
                  </span>
                  <p className="mt-4 max-w-sm text-[15px] text-[var(--text-muted)]">
                    {t("care.subtitle")}
                  </p>
                </div>
              ) : (
                <>
                  {view.seed ? <Bubble who="me">{view.seed}</Bubble> : null}
                  {view.answers.map((a, i) =>
                    a.questionId === "free" ? (
                      <Bubble key={i} who="me">
                        {a.label}
                      </Bubble>
                    ) : (
                      <div key={i} className="space-y-3">
                        <Bubble who="bot">{a.prompt}</Bubble>
                        <Bubble who="me">{a.label}</Bubble>
                      </div>
                    ),
                  )}
                </>
              )}
              {!viewed && thinking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md fh-tile px-4 py-3">
                    <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
                  </div>
                </div>
              )}
              {!viewed && !thinking && step?.kind === "question" && !fresh && (
                <Bubble who="bot">{step.question.prompt}</Bubble>
              )}
              {activeConclusion && (
                <ResultCard
                  conclusion={activeConclusion}
                  onBook={(spec) =>
                    router.push(
                      `/patient/doctors?specialty=${encodeURIComponent(spec)}`,
                    )
                  }
                  onRestart={newCheck}
                  readOnly={!!viewed}
                />
              )}
            </div>
          </div>

          {/* option chips + pill input */}
          <div className="pointer-events-auto mx-auto w-full max-w-2xl px-6 pt-0">
            {fresh && step?.kind === "question" && (
              <p className="mb-3 text-center text-[15px] font-medium text-cream">
                {step.question.prompt}
              </p>
            )}
            {!viewed && !thinking && step?.kind === "question" && (
              <div className="mb-2 flex flex-wrap justify-center gap-2">
                {step.question.options.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => pick(o)}
                    className="flex items-center gap-2 rounded-full fh-card px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:border-primary/50 hover:text-[rgb(var(--c-terracotta))]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--c-terracotta))]" />
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            {viewed ? (
              <button
                onClick={newCheck}
                className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-on-accent"
              >
                <Plus className="h-4 w-4" /> New check
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-full fh-card p-2 shadow-soft-lg">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="h-[18px] w-[18px]" />
                </span>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendText()}
                  placeholder={t("chat.placeholder")}
                  className="flex-1 bg-transparent px-1 py-2 text-[15px] text-cream outline-none placeholder:text-[var(--text-faint)]"
                />
                <button
                  onClick={sendText}
                  disabled={!draft.trim()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-on-accent transition-opacity disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-[18px] w-[18px]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const AREAS: { icon: LucideIcon; title: string; seed: string }[] = [
  { icon: Thermometer, title: "Fever / whole body", seed: "fever" },
  { icon: HeartPulse, title: "Chest / breathing", seed: "chest pain" },
  { icon: Brain, title: "Head / mind", seed: "headache" },
  { icon: Hand, title: "Skin", seed: "skin rash" },
  { icon: Bone, title: "Bones / joints", seed: "joint pain" },
  { icon: Baby, title: "Child", seed: "my child is sick" },
];

function ImmersiveRail({
  icon: Icon,
  title,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="grid h-11 w-11 place-items-center rounded-full fh-card text-[var(--text-muted)] transition-all hover:scale-105 hover:text-[rgb(var(--c-terracotta))]"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-faint)]"
      style={{ animationDelay: delay }}
    />
  );
}

function Bubble({
  who,
  children,
}: {
  who: "bot" | "me";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex", who === "me" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px]",
          who === "me"
            ? "rounded-br-md bg-primary text-on-accent"
            : "fh-tile rounded-bl-md text-cream",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ResultCard({
  conclusion,
  onBook,
  onRestart,
  readOnly,
}: {
  conclusion: DConclusion;
  onBook: (specialty: string) => void;
  onRestart: () => void;
  readOnly?: boolean;
}) {
  const {
    specialty,
    alt,
    conditions,
    advice,
    urgency,
    emergency,
    summary,
    causes,
    alsoSee,
  } = conclusion;
  // Sessions saved before the differential existed replay from localStorage
  // with no `causes` — those fall back to the old condition chips.
  const differential = causes ?? [];
  // One booking row per distinct specialty across the differential, so a case
  // that spans orthopaedics and neurology offers both rather than burying one.
  const specialties = Array.from(
    new Set([
      specialty,
      ...differential.map((c) => c.specialty),
      ...(alsoSee ?? []),
    ]),
  );

  return (
    <div
      className={cn(
        "glass-card animate-fade-up rounded-3xl p-4",
        emergency && "!border-status-critical/40",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
            urgencyTone(urgency),
          )}
        >
          {urgency}
        </span>
        {emergency && (
          <AlertTriangle className="h-4 w-4 text-status-critical" />
        )}
      </div>

      {summary && (
        <p className="mt-3 text-[15px] font-medium leading-snug text-cream">
          {summary}
        </p>
      )}

      {differential.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            What this could be
          </p>
          <ol className="space-y-2">
            {differential.map((c, i) => (
              <li key={`${c.name}-${i}`} className="rounded-2xl fh-tile p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug text-cream">
                    {c.name}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      likelihoodTone(c.likelihood),
                    )}
                  >
                    {likelihoodLabel(c.likelihood)}
                  </span>
                </div>
                {c.why && (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    {c.why}
                  </p>
                )}
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--c-terracotta))]">
                  <Stethoscope className="h-3 w-3 shrink-0" />
                  Treated by {c.specialty}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        conditions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {conditions.map((c) => (
              <span
                key={c}
                className="rounded-full fh-tile px-2.5 py-1 text-xs text-[var(--text-muted)]"
              >
                {c}
              </span>
            ))}
          </div>
        )
      )}

      <p className="mt-3 text-sm text-[var(--text-muted)]">{advice}</p>

      {differential.length === 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Best fit
          </p>
          <p className="text-base font-semibold text-cream">
            {specialty}
            {alt ? (
              <span className="text-[var(--text-faint)]"> · or {alt}</span>
            ) : null}
          </p>
        </div>
      )}

      {/* Red-flag wording still escalates the urgency and says so plainly —
          it just routes to a doctor now rather than raising an alert. */}
      {emergency && (
        <div className="mt-3 rounded-2xl bg-status-critical/10 p-3">
          <p className="flex items-start gap-2 text-sm font-medium text-status-critical">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This needs medical help straight away. Call your local emergency
            number or get to the nearest hospital now.
          </p>
          {/* The words must come with the actions — a warning with no dial
              button is a dead end at the worst possible moment. */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a
              href="tel:112"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-status-critical py-2.5 text-sm font-semibold text-white"
            >
              Call 112 now
            </a>
            <Link
              href="/patient/now"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-status-critical/40 py-2.5 text-sm font-semibold text-status-critical"
            >
              Get emergency care
            </Link>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <button
          onClick={() => onBook(specialty)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-on-accent"
        >
          Find a {specialty} <ArrowRight className="h-4 w-4" />
        </button>

        {/* Secondary specialties from the differential — the whole point is
            that the patient can choose which line to pursue. */}
        {specialties.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {specialties.slice(1).map((sp) => (
              <button
                key={sp}
                onClick={() => onBook(sp)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl fh-tile px-3 py-2.5 text-xs font-medium text-cream transition-colors hover:border-primary/40"
              >
                Or a {sp} <ArrowRight className="h-3 w-3 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {!readOnly && (
          <button
            onClick={onRestart}
            className="w-full rounded-2xl px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-cream"
          >
            Start over
          </button>
        )}
      </div>

      <p className="mt-2 text-[10px] text-[var(--text-faint)]">
        Possibilities to check with a doctor — not a diagnosis.
      </p>
    </div>
  );
}

function ChatSidebar({
  open,
  onClose,
  onNew,
  sessions,
  activeId,
  onOpenSession,
  bookings,
  reports,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  sessions: CheckSession[];
  activeId: string;
  onOpenSession: (s: CheckSession) => void;
  bookings: { id: string; type: string; status: string }[];
  reports: { id: string; type: string; status: string }[];
  t: (k: string) => string;
}) {
  // Portal to <body> — the patient shell wraps pages in `<main class="relative
  // z-10">`, a stacking context that would pin this drawer *below* the shell's
  // z-20 top bar (the wordmark painted over the drawer header) no matter what
  // z-index it asks for. Same escape hatch as components/ui/modal.tsx.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const body = (
    <div className="flex h-full flex-col gap-5">
      <button
        onClick={onNew}
        className="flex items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-on-accent"
      >
        <Plus className="h-4 w-4" /> {t("chat.newChat")}
      </button>

      <SideSection
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label={t("chat.history")}
      >
        {sessions.length === 0 ? (
          <Empty>No checks yet</Empty>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpenSession(s)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                s.id === activeId
                  ? "bg-primary/12 text-primary"
                  : "text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-cream",
              )}
            >
              <span className="flex-1 truncate">{s.title}</span>
              {s.conclusion ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              ) : null}
            </button>
          ))
        )}
      </SideSection>

      <SideSection
        icon={<CalendarClock className="h-3.5 w-3.5" />}
        label={t("chat.bookings")}
      >
        {bookings.length === 0 ? (
          <Empty>No bookings yet</Empty>
        ) : (
          bookings.slice(0, 5).map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-[var(--text-muted)]"
            >
              <Stethoscope className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex-1 truncate capitalize">
                {b.type.replace("_", " ")}
              </span>
              <span className="text-[10px] capitalize text-[var(--text-faint)]">
                {b.status}
              </span>
            </div>
          ))
        )}
      </SideSection>

      <SideSection
        icon={<FileText className="h-3.5 w-3.5" />}
        label={t("chat.reports")}
      >
        {reports.length === 0 ? (
          <Empty>Prescriptions from visits appear here</Empty>
        ) : (
          reports.slice(0, 5).map((r) => (
            <Link
              key={r.id}
              href="/patient"
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-[var(--text-muted)] hover:text-cream"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex-1 truncate capitalize">
                {r.type.replace("_", " ")} report
              </span>
            </Link>
          ))
        )}
      </SideSection>
    </div>
  );

  // Drawer usable on all sizes (mobile compose + desktop immersive both open it).
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="absolute inset-y-0 left-0 w-[82%] max-w-sm animate-fade-up overflow-y-auto border-r border-[var(--border)] bg-[var(--glass-bg-strong)] p-4 shadow-soft-lg backdrop-blur-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-cream">
            {t("care.title")}
          </span>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  );
}

function SideSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 py-1.5 text-xs text-[var(--text-faint)]">{children}</p>
  );
}
