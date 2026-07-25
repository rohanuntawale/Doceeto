/**
 * Adaptive symptom checker — an "Akinator for health". Instead of one
 * free-text box, it asks one question at a time and REGENERATES the next
 * set of option chips from the answers so far, narrowing toward a likely
 * body-system + bookable specialty + urgency.
 *
 * It is a deterministic, offline decision engine (no network, no latency)
 * with a clean seam (`nextStep`) so a real LLM can replace the question
 * picker later without touching the UI. Every branch still ends at a
 * bookable specialty, and red-flag options short-circuit to SOS.
 *
 * Patient history is fed in as priors so repeat concerns surface sooner.
 */
import { analyzeSymptoms, type Urgency } from "@/lib/triage";
import type { SosCategory } from "@/lib/types/domain";

export type { Urgency };

/** Bookable specialties — must match what a doctor can register with. */
export type Specialty =
  | "General Physician"
  | "Cardiologist"
  | "Gynecologist"
  | "Pediatrician"
  | "Orthopedic"
  | "Dermatologist"
  | "ENT"
  | "Psychiatrist";

export interface DOption {
  /** stable value used to record the answer */
  value: string;
  label: string;
  emoji?: string;
  /** score deltas added to specialties when picked */
  score?: Partial<Record<Specialty, number>>;
  /** plain-language possibilities this answer suggests (not a diagnosis) */
  conditions?: string[];
  /** bump the running urgency */
  urgency?: Urgency;
  /** a red-flag → jumps straight to an emergency conclusion */
  flag?: { label: string; sos: SosCategory };
  /** tags recorded on the state so later questions can gate on them */
  tags?: string[];
}

export interface DQuestion {
  id: string;
  prompt: string;
  hint?: string;
  multi?: boolean;
  options: DOption[];
  /** only asked when this predicate passes for the current state */
  when?: (s: DState) => boolean;
}

export interface DAnswer {
  questionId: string;
  prompt: string;
  value: string;
  label: string;
}

export interface DState {
  seed: string;
  scores: Record<string, number>;
  conditions: string[];
  tags: string[];
  urgency: Urgency;
  flags: { label: string; sos: SosCategory }[];
  answers: DAnswer[];
  askedIds: string[];
}

export interface DConclusion {
  kind: "conclusion";
  urgency: Urgency;
  specialty: Specialty;
  alt?: Specialty;
  conditions: string[];
  advice: string;
  emergency: boolean;
  sosCategory?: SosCategory;
}

export type DStep =
  | { kind: "question"; question: DQuestion }
  | DConclusion;

const RANK: Record<Urgency, number> = { routine: 0, urgent: 1, emergency: 2 };
const bump = (a: Urgency, b: Urgency): Urgency => (RANK[b] > RANK[a] ? b : a);

const has = (s: DState, tag: string) => s.tags.includes(tag);
const scoreOf = (s: DState, sp: Specialty) => s.scores[sp] ?? 0;

// ── Question bank ─────────────────────────────────────────────
// Ordered as a funnel; `when` gates relevance. nextStep asks the first
// unanswered, relevant one.

const Q_SEVERE: DQuestion = {
  id: "severe",
  prompt: "First, is any of this happening right now?",
  hint: "These need emergency help, not an appointment.",
  options: [
    { value: "breath", label: "Struggling to breathe", emoji: "🫁", flag: { label: "Trouble breathing", sos: "respiratory" } },
    { value: "chest", label: "Chest pain spreading to arm or jaw", emoji: "❤️", flag: { label: "Heart-attack signs", sos: "cardiac" } },
    { value: "faint", label: "Fainting, confusion or a seizure", emoji: "🌀", flag: { label: "Loss of consciousness", sos: "other" } },
    { value: "bleed", label: "Heavy bleeding that won't stop", emoji: "🩸", flag: { label: "Severe bleeding", sos: "trauma" } },
    { value: "none", label: "None of these", emoji: "✅", tags: ["screened"] },
  ],
};

const Q_AREA: DQuestion = {
  id: "area",
  prompt: "Where's the main problem?",
  when: (s) => has(s, "screened") && !s.tags.some((t) => t.startsWith("area:")),
  options: [
    { value: "fever", label: "Fever or whole-body", emoji: "🤒", score: { "General Physician": 3 }, conditions: ["Possible infection / general illness"], tags: ["area:fever"] },
    { value: "head", label: "Head, throat or ears", emoji: "🤕", score: { ENT: 2, "General Physician": 1 }, tags: ["area:head"] },
    { value: "chest", label: "Chest or breathing", emoji: "🫁", score: { Cardiologist: 2, "General Physician": 1 }, tags: ["area:chest"] },
    { value: "tummy", label: "Stomach or digestion", emoji: "🍽️", score: { "General Physician": 3 }, conditions: ["Digestive / stomach problem"], tags: ["area:tummy"] },
    { value: "skin", label: "Skin, hair or nails", emoji: "🧴", score: { Dermatologist: 3 }, conditions: ["Skin condition"], tags: ["area:skin"] },
    { value: "bones", label: "Bones, joints or muscles", emoji: "🦴", score: { Orthopedic: 3 }, conditions: ["Bone / joint / muscle problem"], tags: ["area:bones"] },
    { value: "mind", label: "Mood, sleep or stress", emoji: "🧠", score: { Psychiatrist: 3 }, conditions: ["Mental-health / stress concern"], tags: ["area:mind"] },
    { value: "women", label: "Women's or pregnancy", emoji: "🤰", score: { Gynecologist: 3 }, conditions: ["Gynaecological / pregnancy-related concern"], tags: ["area:women"] },
    { value: "child", label: "It's for my child", emoji: "🧒", score: { Pediatrician: 4 }, conditions: ["Child health concern"], tags: ["area:child"] },
  ],
};

const Q_CHEST: DQuestion = {
  id: "chest",
  prompt: "What does the chest feel like?",
  when: (s) => has(s, "area:chest"),
  options: [
    { value: "pressure", label: "Tight, heavy or pressure", emoji: "🫀", score: { Cardiologist: 4 }, conditions: ["Possible heart-related problem"], urgency: "urgent" },
    { value: "cough", label: "Cough, cold or wheeze", emoji: "😮‍💨", score: { "General Physician": 4 }, conditions: ["Chest infection / breathing issue"] },
    { value: "sharp", label: "Sharp, worse on breathing in", emoji: "📌", score: { "General Physician": 3, Cardiologist: 1 }, urgency: "urgent" },
    { value: "palp", label: "Racing or skipping heartbeat", emoji: "💓", score: { Cardiologist: 4 }, conditions: ["Palpitations"], urgency: "urgent" },
  ],
};

const Q_HEAD: DQuestion = {
  id: "head",
  prompt: "Which fits best?",
  when: (s) => has(s, "area:head"),
  options: [
    { value: "throat", label: "Sore throat or ear pain", emoji: "👂", score: { ENT: 4 }, conditions: ["Ear / nose / throat issue"] },
    { value: "sinus", label: "Blocked nose or sinus", emoji: "👃", score: { ENT: 3, "General Physician": 1 }, conditions: ["Sinus / cold"] },
    { value: "headache", label: "Headache or migraine", emoji: "🤯", score: { "General Physician": 3 }, conditions: ["Headache / migraine"] },
    { value: "dizzy", label: "Dizziness or balance", emoji: "🌀", score: { "General Physician": 2, ENT: 2 }, conditions: ["Dizziness"] },
  ],
};

const Q_TUMMY: DQuestion = {
  id: "tummy",
  prompt: "What's the stomach trouble?",
  when: (s) => has(s, "area:tummy"),
  options: [
    { value: "vomit", label: "Vomiting or loose motions", emoji: "🤢", score: { "General Physician": 4 }, conditions: ["Stomach infection"], urgency: "urgent" },
    { value: "acidity", label: "Burning or acidity", emoji: "🔥", score: { "General Physician": 3 }, conditions: ["Acidity / indigestion"] },
    { value: "lowerpain", label: "Lower belly pain", emoji: "😖", score: { "General Physician": 2, Gynecologist: 1 } },
    { value: "constip", label: "Constipation or gas", emoji: "🫧", score: { "General Physician": 3 } },
  ],
};

const Q_SKIN: DQuestion = {
  id: "skin",
  prompt: "What does the skin issue look like?",
  when: (s) => has(s, "area:skin"),
  options: [
    { value: "rash", label: "Rash or itching", emoji: "🌡️", score: { Dermatologist: 3 } },
    { value: "acne", label: "Acne or pimples", emoji: "🔴", score: { Dermatologist: 3 } },
    { value: "hair", label: "Hair fall", emoji: "💇", score: { Dermatologist: 3 } },
    { value: "infection", label: "Fungal or spreading", emoji: "🍄", score: { Dermatologist: 3 }, urgency: "urgent" },
  ],
};

const Q_BONES: DQuestion = {
  id: "bones",
  prompt: "What happened?",
  when: (s) => has(s, "area:bones"),
  options: [
    { value: "injury", label: "A fall or injury", emoji: "🩹", score: { Orthopedic: 4 }, urgency: "urgent" },
    { value: "joint", label: "Joint or knee pain", emoji: "🦵", score: { Orthopedic: 3 } },
    { value: "back", label: "Back or neck pain", emoji: "🔙", score: { Orthopedic: 3 } },
    { value: "swelling", label: "Swelling in a limb", emoji: "🫃", score: { Orthopedic: 3 }, urgency: "urgent" },
  ],
};

const Q_MIND: DQuestion = {
  id: "mind",
  prompt: "What's been hardest?",
  when: (s) => has(s, "area:mind"),
  options: [
    { value: "anxiety", label: "Anxiety or panic", emoji: "😰", score: { Psychiatrist: 4 } },
    { value: "low", label: "Feeling low or hopeless", emoji: "😔", score: { Psychiatrist: 4 }, urgency: "urgent" },
    { value: "sleep", label: "Can't sleep", emoji: "🌙", score: { Psychiatrist: 3 } },
    { value: "stress", label: "Stress or burnout", emoji: "😵", score: { Psychiatrist: 3 } },
  ],
};

const Q_WOMEN: DQuestion = {
  id: "women",
  prompt: "Which is it about?",
  when: (s) => has(s, "area:women"),
  options: [
    { value: "pregnancy", label: "Pregnancy care", emoji: "🤰", score: { Gynecologist: 4 } },
    { value: "period", label: "Period problems", emoji: "🩸", score: { Gynecologist: 4 } },
    { value: "pcos", label: "PCOS / hormonal", emoji: "⚖️", score: { Gynecologist: 3 } },
    { value: "other", label: "Something else", emoji: "💬", score: { Gynecologist: 2, "General Physician": 1 } },
  ],
};

const Q_DURATION: DQuestion = {
  id: "duration",
  prompt: "How long has this been going on?",
  when: (s) => s.answers.length >= 2 && !has(s, "dur"),
  options: [
    { value: "today", label: "Started today", emoji: "🕐", urgency: "urgent", tags: ["dur"] },
    { value: "days", label: "A few days", emoji: "📅", tags: ["dur"] },
    { value: "week", label: "About a week", emoji: "🗓️", tags: ["dur"] },
    { value: "long", label: "Weeks or more", emoji: "⏳", tags: ["dur"] },
  ],
};

const Q_SEVERITY: DQuestion = {
  id: "severity",
  prompt: "How bad is it right now?",
  when: (s) => s.answers.length >= 3 && !has(s, "sev"),
  options: [
    { value: "mild", label: "Mild, manageable", emoji: "🙂", tags: ["sev"] },
    { value: "moderate", label: "Moderate, bothering me", emoji: "😕", tags: ["sev"] },
    { value: "severe", label: "Severe, hard to cope", emoji: "😣", urgency: "urgent", tags: ["sev"] },
  ],
};

const BANK: DQuestion[] = [
  Q_SEVERE,
  Q_AREA,
  Q_CHEST,
  Q_HEAD,
  Q_TUMMY,
  Q_SKIN,
  Q_BONES,
  Q_MIND,
  Q_WOMEN,
  Q_DURATION,
  Q_SEVERITY,
];

/** Fresh session. Seed free-text + prior conditions prime the scores so the
 *  checker feels like it already knows the patient. */
export function initState(seed = "", historyConditions: string[] = []): DState {
  const state: DState = {
    seed: seed.trim(),
    scores: {},
    conditions: [],
    tags: [],
    urgency: "routine",
    flags: [],
    answers: [],
    askedIds: [],
  };

  // Seed text → prime scores from the keyword triage.
  if (state.seed.length >= 4) {
    const t = analyzeSymptoms(state.seed);
    if (t) {
      t.specialties.forEach((sp, i) => addScore(state, sp as Specialty, 3 - i));
      t.conditions.forEach((c) => addCondition(state, c));
      state.urgency = bump(state.urgency, t.urgency);
      if (t.redFlags[0])
        state.flags.push({ label: t.redFlags[0], sos: t.sosCategory ?? "other" });
      state.tags.push("seeded");
    }
  }

  // History priors — repeat concerns get a nudge (continuity of care).
  historyConditions.forEach((c) => {
    const sp = conditionToSpecialty(c);
    if (sp) addScore(state, sp, 1);
  });

  return state;
}

function addScore(s: DState, sp: Specialty, n: number) {
  s.scores[sp] = (s.scores[sp] ?? 0) + n;
}
function addCondition(s: DState, c: string) {
  if (!s.conditions.includes(c)) s.conditions.push(c);
}

/** Record an answer and fold its effects into the running state. */
export function applyAnswer(prev: DState, q: DQuestion, opt: DOption): DState {
  const s: DState = {
    ...prev,
    scores: { ...prev.scores },
    conditions: [...prev.conditions],
    tags: [...prev.tags],
    flags: [...prev.flags],
    answers: [...prev.answers, { questionId: q.id, prompt: q.prompt, value: opt.value, label: opt.label }],
    askedIds: prev.askedIds.includes(q.id) ? prev.askedIds : [...prev.askedIds, q.id],
  };
  if (opt.score) for (const k in opt.score) addScore(s, k as Specialty, opt.score[k as Specialty]!);
  if (opt.conditions) opt.conditions.forEach((c) => addCondition(s, c));
  if (opt.urgency) s.urgency = bump(s.urgency, opt.urgency);
  if (opt.tags) opt.tags.forEach((t) => !s.tags.includes(t) && s.tags.push(t));
  if (opt.flag) s.flags.push(opt.flag);
  return s;
}

/** Fold free-text the patient types mid-flow into the running state, so the
 *  chat box and the option chips drive the same funnel. */
export function applyText(prev: DState, text: string): DState {
  const clean = text.trim();
  const s: DState = {
    ...prev,
    scores: { ...prev.scores },
    conditions: [...prev.conditions],
    tags: [...prev.tags],
    flags: [...prev.flags],
    answers: [
      ...prev.answers,
      { questionId: "free", prompt: "You told us", value: clean, label: clean },
    ],
    askedIds: [...prev.askedIds],
  };
  const t = analyzeSymptoms(clean);
  if (t) {
    t.specialties.forEach((sp, i) => addScore(s, sp as Specialty, 3 - i));
    t.conditions.forEach((c) => addCondition(s, c));
    s.urgency = bump(s.urgency, t.urgency);
    if (t.redFlags[0]) s.flags.push({ label: t.redFlags[0], sos: t.sosCategory ?? "other" });
  }
  if (!s.tags.includes("seeded")) s.tags.push("seeded");
  return s;
}

/** Rank specialties by score (history/seed included). */
export function ranked(s: DState): { specialty: Specialty; score: number }[] {
  return Object.entries(s.scores)
    .map(([specialty, score]) => ({ specialty: specialty as Specialty, score }))
    .sort((a, b) => b.score - a.score);
}

/** The heart of the loop: given the state, either the next question to ask
 *  (with freshly-relevant options) or a final conclusion. Swap this body for
 *  an LLM call later; the UI only depends on the DStep shape. */
export function nextStep(s: DState): DStep {
  // Emergency short-circuit.
  if (s.flags.length > 0) return conclude(s, true);

  // Ask the first relevant, unanswered question.
  const q = BANK.find(
    (question) =>
      !s.askedIds.includes(question.id) && (question.when ? question.when(s) : true),
  );
  if (q) return { kind: "question", question: q };

  // No more relevant questions → conclude.
  return conclude(s);
}

function conclude(s: DState, emergency = false): DConclusion {
  const order = ranked(s);
  const specialty = (order[0]?.specialty ?? "General Physician") as Specialty;
  const alt = order[1]?.specialty as Specialty | undefined;
  const conditions = s.conditions.length ? s.conditions : ["General consultation"];

  if (emergency) {
    const flag = s.flags[0];
    return {
      kind: "conclusion",
      urgency: "emergency",
      specialty,
      alt,
      conditions: [flag?.label ?? "Emergency", ...conditions],
      emergency: true,
      sosCategory: flag?.sos ?? "other",
      advice:
        "This looks like it could be an emergency. Press SOS now — an ambulance and the nearest doctor get your location instantly.",
    };
  }

  const advice =
    s.urgency === "urgent"
      ? `Best seen soon by a ${specialty}. Book a home visit or video call below — press SOS if it gets worse.`
      : `A ${specialty} is a good fit for this. Book a visit whenever you're ready.`;

  return {
    kind: "conclusion",
    urgency: s.urgency,
    specialty,
    alt,
    conditions,
    emergency: false,
    advice,
  };
}

/** Loose reverse-map so history conditions can nudge scores. */
function conditionToSpecialty(c: string): Specialty | null {
  const t = c.toLowerCase();
  if (/heart|cardiac|palpitation/.test(t)) return "Cardiologist";
  if (/skin/.test(t)) return "Dermatologist";
  if (/bone|joint|muscle/.test(t)) return "Orthopedic";
  if (/ear|nose|throat|sinus/.test(t)) return "ENT";
  if (/mental|stress|anxiety|mood/.test(t)) return "Psychiatrist";
  if (/gyn|pregnan|period/.test(t)) return "Gynecologist";
  if (/child/.test(t)) return "Pediatrician";
  if (/stomach|digest|infection|viral|general/.test(t)) return "General Physician";
  return null;
}
