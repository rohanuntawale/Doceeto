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
import { analyzeSymptoms, type TriageResult, type Urgency } from "@/lib/triage";
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
  | "Psychiatrist"
  | "Neurologist";

/** How strongly the answers point at a cause. Deliberately three coarse
 *  buckets — a percentage would imply precision a triage funnel doesn't have. */
export type Likelihood = "likely" | "possible" | "less-likely";

/**
 * One entry in the differential: a plain-language possibility plus the
 * specialty that treats it. This is the point of the checker — a symptom
 * rarely maps to a single doctor. Back pain can be a muscle strain (Orthopedic)
 * or a pinched nerve (Neurologist); chest tightness can be the heart
 * (Cardiologist) or reflux (General Physician). The patient should see the
 * candidates and who handles each, not just one specialty handed down.
 */
export interface DCause {
  /** plain-language possibility — never phrased as a settled diagnosis */
  name: string;
  likelihood: Likelihood;
  /** one short line: why this fits what they told us */
  why?: string;
  /** who treats it — must be bookable */
  specialty: Specialty;
}

export interface DOption {
  /** stable value used to record the answer */
  value: string;
  label: string;
  emoji?: string;
  /** score deltas added to specialties when picked */
  score?: Partial<Record<Specialty, number>>;
  /** plain-language possibilities this answer suggests (not a diagnosis) */
  conditions?: string[];
  /** candidate causes this answer opens up, each with its own specialty */
  causes?: DCause[];
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
  /**
   * Option to assume when the patient answers this in prose instead of
   * tapping a chip. Without it a typed reply would skip the question and
   * lose the tags later questions gate on.
   */
  assumeWhenTyped?: string;
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
  /** running differential, deduped by name */
  causes: DCause[];
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
  /** plain-language read of what's most likely going on */
  summary?: string;
  /** ranked differential. Optional because sessions saved before this existed
   *  are replayed from localStorage and have no causes — the UI falls back to
   *  showing `conditions` for those. */
  causes?: DCause[];
  /** Extra specialties the advice recommends that no cause covers, so the UI
   *  can still offer a booking button for them. */
  alsoSee?: Specialty[];
}

export type DStep =
  | { kind: "question"; question: DQuestion }
  | DConclusion;

const RANK: Record<Urgency, number> = { routine: 0, urgent: 1, emergency: 2 };
const bump = (a: Urgency, b: Urgency): Urgency => (RANK[b] > RANK[a] ? b : a);

const LIK_RANK: Record<Likelihood, number> = { likely: 2, possible: 1, "less-likely": 0 };

const has = (s: DState, tag: string) => s.tags.includes(tag);
const scoreOf = (s: DState, sp: Specialty) => s.scores[sp] ?? 0;

// ── Question bank ─────────────────────────────────────────────
// Ordered as a funnel; `when` gates relevance. nextStep asks the first
// unanswered, relevant one.

const Q_SEVERE: DQuestion = {
  id: "severe",
  prompt: "First, is any of this happening right now?",
  hint: "These need emergency help, not an appointment.",
  // Prose is read as "none of these" — safe because the red-flag keyword
  // scan runs on that same text first and short-circuits to SOS if it hits.
  assumeWhenTyped: "none",
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
    {
      value: "pressure",
      label: "Tight, heavy or pressure",
      emoji: "🫀",
      score: { Cardiologist: 4 },
      conditions: ["Possible heart-related problem"],
      urgency: "urgent",
      causes: [
        { name: "Reduced blood flow to the heart", likelihood: "possible", why: "Tight, heavy chest pressure is the classic pattern.", specialty: "Cardiologist" },
        { name: "Acid reflux mimicking heart pain", likelihood: "possible", why: "Reflux causes very similar pressure behind the breastbone.", specialty: "General Physician" },
        { name: "Chest wall or muscle strain", likelihood: "less-likely", why: "Possible if it followed lifting or coughing.", specialty: "Orthopedic" },
      ],
    },
    {
      value: "cough",
      label: "Cough, cold or wheeze",
      emoji: "😮‍💨",
      score: { "General Physician": 4 },
      conditions: ["Chest infection / breathing issue"],
      causes: [
        { name: "Chest infection or bronchitis", likelihood: "likely", why: "Cough with chest discomfort usually means an airway infection.", specialty: "General Physician" },
        { name: "Asthma or allergic airway narrowing", likelihood: "possible", why: "Wheeze points at the airways tightening.", specialty: "General Physician" },
      ],
    },
    {
      value: "sharp",
      label: "Sharp, worse on breathing in",
      emoji: "📌",
      score: { "General Physician": 3, Cardiologist: 1 },
      urgency: "urgent",
      causes: [
        { name: "Inflammation of the lung lining", likelihood: "possible", why: "Pain that sharpens when you breathe in fits the lung lining.", specialty: "General Physician" },
        { name: "Rib or muscle strain", likelihood: "possible", why: "Movement-linked sharp pain is often muscular.", specialty: "Orthopedic" },
      ],
    },
    {
      value: "palp",
      label: "Racing or skipping heartbeat",
      emoji: "💓",
      score: { Cardiologist: 4 },
      conditions: ["Palpitations"],
      urgency: "urgent",
      causes: [
        { name: "Irregular heart rhythm", likelihood: "possible", why: "A racing or skipping beat needs a rhythm check.", specialty: "Cardiologist" },
        { name: "Anxiety or an overactive thyroid", likelihood: "possible", why: "Both commonly cause palpitations with a normal heart.", specialty: "General Physician" },
      ],
    },
  ],
};

const Q_HEAD: DQuestion = {
  id: "head",
  prompt: "Which fits best?",
  when: (s) => has(s, "area:head"),
  options: [
    {
      value: "throat",
      label: "Sore throat or ear pain",
      emoji: "👂",
      score: { ENT: 4 },
      conditions: ["Ear / nose / throat issue"],
      causes: [
        { name: "Throat or tonsil infection", likelihood: "likely", why: "Sore throat with pain on swallowing.", specialty: "ENT" },
        { name: "Middle-ear infection", likelihood: "possible", why: "Ear pain often travels with a throat infection.", specialty: "ENT" },
      ],
    },
    {
      value: "sinus",
      label: "Blocked nose or sinus",
      emoji: "👃",
      score: { ENT: 3, "General Physician": 1 },
      conditions: ["Sinus / cold"],
      causes: [
        { name: "Sinus infection", likelihood: "likely", why: "Blockage with facial pressure fits the sinuses.", specialty: "ENT" },
        { name: "Allergic rhinitis", likelihood: "possible", why: "Common if it comes and goes with dust or weather.", specialty: "General Physician" },
      ],
    },
    {
      value: "headache",
      label: "Headache or migraine",
      emoji: "🤯",
      score: { "General Physician": 2, Neurologist: 2 },
      conditions: ["Headache / migraine"],
      causes: [
        { name: "Tension headache", likelihood: "likely", why: "The commonest cause — tight band-like head pain.", specialty: "General Physician" },
        { name: "Migraine", likelihood: "possible", why: "Fits if it throbs, or light and sound make it worse.", specialty: "Neurologist" },
        { name: "Sinus-related headache", likelihood: "possible", why: "Fits if the pain sits over the forehead or cheeks.", specialty: "ENT" },
      ],
    },
    // Balance sits between the inner ear and the nerves, so it stays a tie
    // until the duration and severity answers break it.
    {
      value: "dizzy",
      label: "Dizziness or balance",
      emoji: "🌀",
      score: { ENT: 2, Neurologist: 2, "General Physician": 1 },
      conditions: ["Dizziness"],
      causes: [
        { name: "Inner-ear vertigo", likelihood: "possible", why: "Spinning that changes with head position starts in the ear.", specialty: "ENT" },
        { name: "Low blood pressure or low haemoglobin", likelihood: "possible", why: "Light-headedness on standing points here.", specialty: "General Physician" },
        { name: "A nerve or brain-related cause", likelihood: "less-likely", why: "Considered when balance is off even while sitting still.", specialty: "Neurologist" },
      ],
    },
    {
      value: "nerve",
      label: "Numbness, tremor or fits",
      emoji: "⚡",
      score: { Neurologist: 4 },
      conditions: ["Nerve / brain-related symptom"],
      urgency: "urgent",
      causes: [
        { name: "Nerve compression or damage", likelihood: "possible", why: "Numbness and tingling follow a squeezed nerve.", specialty: "Neurologist" },
        { name: "A seizure or tremor disorder", likelihood: "possible", why: "Fits and tremors need a nerve specialist's read.", specialty: "Neurologist" },
        { name: "Low vitamin B12 or thyroid problem", likelihood: "possible", why: "Both cause numbness and are simple to test for.", specialty: "General Physician" },
      ],
    },
  ],
};

const Q_TUMMY: DQuestion = {
  id: "tummy",
  prompt: "What's the stomach trouble?",
  when: (s) => has(s, "area:tummy"),
  options: [
    {
      value: "vomit",
      label: "Vomiting or loose motions",
      emoji: "🤢",
      score: { "General Physician": 4 },
      conditions: ["Stomach infection"],
      urgency: "urgent",
      causes: [
        { name: "Stomach infection or food poisoning", likelihood: "likely", why: "Vomiting with loose motions is the classic pattern.", specialty: "General Physician" },
        { name: "Dehydration from fluid loss", likelihood: "possible", why: "Follows quickly once vomiting and motions set in.", specialty: "General Physician" },
      ],
    },
    {
      value: "acidity",
      label: "Burning or acidity",
      emoji: "🔥",
      score: { "General Physician": 3 },
      conditions: ["Acidity / indigestion"],
      causes: [
        { name: "Acid reflux or gastritis", likelihood: "likely", why: "Burning that's worse after meals or lying down.", specialty: "General Physician" },
        { name: "Stomach ulcer", likelihood: "possible", why: "Considered when the burning keeps coming back.", specialty: "General Physician" },
        { name: "Heart-related pain mistaken for acidity", likelihood: "less-likely", why: "Worth ruling out if it comes on with exertion.", specialty: "Cardiologist" },
      ],
    },
    {
      value: "lowerpain",
      label: "Lower belly pain",
      emoji: "😖",
      score: { "General Physician": 2, Gynecologist: 1 },
      causes: [
        { name: "Urine infection", likelihood: "possible", why: "Common cause of lower belly pain, especially with burning.", specialty: "General Physician" },
        { name: "Period or ovary-related cause", likelihood: "possible", why: "Fits if it tracks with the monthly cycle.", specialty: "Gynecologist" },
        { name: "Appendicitis", likelihood: "less-likely", why: "Needs ruling out if pain settles low on the right and worsens.", specialty: "General Physician" },
      ],
    },
    {
      value: "constip",
      label: "Constipation or gas",
      emoji: "🫧",
      score: { "General Physician": 3 },
      causes: [
        { name: "Constipation from diet or low fluids", likelihood: "likely", why: "The usual cause, and the easiest to correct.", specialty: "General Physician" },
        { name: "Irritable bowel syndrome", likelihood: "possible", why: "Fits when bloating and habit changes keep recurring.", specialty: "General Physician" },
      ],
    },
  ],
};

const Q_SKIN: DQuestion = {
  id: "skin",
  prompt: "What does the skin issue look like?",
  when: (s) => has(s, "area:skin"),
  options: [
    {
      value: "rash",
      label: "Rash or itching",
      emoji: "🌡️",
      score: { Dermatologist: 3 },
      causes: [
        { name: "Eczema or an allergic rash", likelihood: "likely", why: "Itchy rashes are most often allergic or eczema.", specialty: "Dermatologist" },
        { name: "Contact reaction to soap, metal or plants", likelihood: "possible", why: "Fits if it appeared where something touched the skin.", specialty: "Dermatologist" },
        { name: "Rash from an infection like dengue", likelihood: "less-likely", why: "Considered when a fever came with it.", specialty: "General Physician" },
      ],
    },
    {
      value: "acne",
      label: "Acne or pimples",
      emoji: "🔴",
      score: { Dermatologist: 3 },
      causes: [
        { name: "Acne", likelihood: "likely", why: "Blocked oil glands — the standard cause.", specialty: "Dermatologist" },
        { name: "A hormonal cause such as PCOS", likelihood: "possible", why: "Considered with irregular periods or jawline acne.", specialty: "Gynecologist" },
      ],
    },
    {
      value: "hair",
      label: "Hair fall",
      emoji: "💇",
      score: { Dermatologist: 3 },
      causes: [
        { name: "Pattern hair loss", likelihood: "likely", why: "The commonest cause, often runs in the family.", specialty: "Dermatologist" },
        { name: "Low iron, thyroid or vitamin problem", likelihood: "possible", why: "Very common and reversible — worth a blood test.", specialty: "General Physician" },
        { name: "Scalp fungal infection", likelihood: "possible", why: "Fits with flaking, itching or patchy loss.", specialty: "Dermatologist" },
      ],
    },
    {
      value: "infection",
      label: "Fungal or spreading",
      emoji: "🍄",
      score: { Dermatologist: 3 },
      urgency: "urgent",
      causes: [
        { name: "Fungal skin infection", likelihood: "likely", why: "Spreading, ring-like itchy patches.", specialty: "Dermatologist" },
        { name: "Bacterial skin infection", likelihood: "possible", why: "Considered when the skin is hot, painful or oozing.", specialty: "General Physician" },
      ],
    },
  ],
};

const Q_BONES: DQuestion = {
  id: "bones",
  prompt: "What happened?",
  when: (s) => has(s, "area:bones"),
  options: [
    {
      value: "injury",
      label: "A fall or injury",
      emoji: "🩹",
      score: { Orthopedic: 4 },
      urgency: "urgent",
      causes: [
        { name: "Fracture or sprain", likelihood: "likely", why: "Pain straight after a fall usually means bone or ligament.", specialty: "Orthopedic" },
        { name: "Torn ligament or cartilage", likelihood: "possible", why: "Fits if the joint feels loose or locks up.", specialty: "Orthopedic" },
        { name: "Nerve bruised in the injury", likelihood: "less-likely", why: "Considered if there's numbness or weakness past the injury.", specialty: "Neurologist" },
      ],
    },
    {
      value: "joint",
      label: "Joint or knee pain",
      emoji: "🦵",
      score: { Orthopedic: 3 },
      causes: [
        { name: "Joint wear (osteoarthritis)", likelihood: "likely", why: "Gradual joint pain that's worse on movement.", specialty: "Orthopedic" },
        { name: "Inflammatory arthritis or gout", likelihood: "possible", why: "Fits if the joint is hot, red and swollen in attacks.", specialty: "Orthopedic" },
        { name: "Vitamin D or calcium deficiency", likelihood: "possible", why: "A very common cause of aching joints, easily tested.", specialty: "General Physician" },
      ],
    },
    {
      value: "back",
      label: "Back or neck pain",
      emoji: "🔙",
      score: { Orthopedic: 3 },
      causes: [
        { name: "Muscle strain", likelihood: "likely", why: "The commonest cause of back and neck pain.", specialty: "Orthopedic" },
        { name: "Slipped disc pressing on a nerve", likelihood: "possible", why: "Fits if pain shoots down an arm or leg.", specialty: "Orthopedic" },
        { name: "Pinched nerve (sciatica)", likelihood: "possible", why: "Fits with tingling, numbness or weakness in a limb.", specialty: "Neurologist" },
      ],
    },
    {
      value: "swelling",
      label: "Swelling in a limb",
      emoji: "🫃",
      score: { Orthopedic: 3 },
      urgency: "urgent",
      causes: [
        { name: "Swelling from injury or infection", likelihood: "possible", why: "The usual cause when one limb swells.", specialty: "Orthopedic" },
        { name: "A clot in a deep vein", likelihood: "possible", why: "Needs ruling out when one leg swells and aches.", specialty: "General Physician" },
      ],
    },
  ],
};

const Q_MIND: DQuestion = {
  id: "mind",
  prompt: "What's been hardest?",
  when: (s) => has(s, "area:mind"),
  options: [
    {
      value: "anxiety",
      label: "Anxiety or panic",
      emoji: "😰",
      score: { Psychiatrist: 4 },
      causes: [
        { name: "Anxiety or panic disorder", likelihood: "likely", why: "Racing worry with physical symptoms fits anxiety.", specialty: "Psychiatrist" },
        { name: "An overactive thyroid", likelihood: "possible", why: "Mimics anxiety closely and shows up on a blood test.", specialty: "General Physician" },
      ],
    },
    {
      value: "low",
      label: "Feeling low or hopeless",
      emoji: "😔",
      score: { Psychiatrist: 4 },
      urgency: "urgent",
      causes: [
        { name: "Depression", likelihood: "likely", why: "Persistent low mood and loss of interest.", specialty: "Psychiatrist" },
        { name: "Thyroid or vitamin deficiency", likelihood: "possible", why: "Both can flatten mood and energy.", specialty: "General Physician" },
      ],
    },
    {
      value: "sleep",
      label: "Can't sleep",
      emoji: "🌙",
      score: { Psychiatrist: 3 },
      causes: [
        { name: "Insomnia, often driven by stress", likelihood: "likely", why: "Trouble falling or staying asleep.", specialty: "Psychiatrist" },
        { name: "Sleep apnoea", likelihood: "possible", why: "Considered with loud snoring and daytime sleepiness.", specialty: "ENT" },
      ],
    },
    {
      value: "stress",
      label: "Stress or burnout",
      emoji: "😵",
      score: { Psychiatrist: 3 },
      causes: [
        { name: "Stress reaction or burnout", likelihood: "likely", why: "Exhaustion tied to ongoing pressure.", specialty: "Psychiatrist" },
        { name: "Low haemoglobin or thyroid problem", likelihood: "possible", why: "Physical causes of constant tiredness are worth excluding.", specialty: "General Physician" },
      ],
    },
  ],
};

const Q_WOMEN: DQuestion = {
  id: "women",
  prompt: "Which is it about?",
  when: (s) => has(s, "area:women"),
  options: [
    {
      value: "pregnancy",
      label: "Pregnancy care",
      emoji: "🤰",
      score: { Gynecologist: 4 },
      causes: [
        { name: "Routine pregnancy care", likelihood: "likely", why: "Checks and scans through the pregnancy.", specialty: "Gynecologist" },
      ],
    },
    {
      value: "period",
      label: "Period problems",
      emoji: "🩸",
      score: { Gynecologist: 4 },
      causes: [
        { name: "Hormonal imbalance", likelihood: "likely", why: "The usual reason periods turn irregular.", specialty: "Gynecologist" },
        { name: "Fibroids or a growth in the womb", likelihood: "possible", why: "Considered with heavy or prolonged bleeding.", specialty: "Gynecologist" },
        { name: "Low haemoglobin from heavy periods", likelihood: "possible", why: "Explains tiredness alongside heavy bleeding.", specialty: "General Physician" },
      ],
    },
    {
      value: "pcos",
      label: "PCOS / hormonal",
      emoji: "⚖️",
      score: { Gynecologist: 3 },
      causes: [
        { name: "PCOS", likelihood: "likely", why: "Irregular cycles with weight or skin changes.", specialty: "Gynecologist" },
        { name: "Thyroid problem", likelihood: "possible", why: "Also disturbs cycles and weight.", specialty: "General Physician" },
      ],
    },
    {
      value: "other",
      label: "Something else",
      emoji: "💬",
      score: { Gynecologist: 2, "General Physician": 1 },
      causes: [
        { name: "Needs a gynaecologist's assessment", likelihood: "possible", why: "Best narrowed down in person.", specialty: "Gynecologist" },
      ],
    },
  ],
};

const Q_FEVER: DQuestion = {
  id: "fever",
  prompt: "What comes with the fever?",
  when: (s) => has(s, "area:fever"),
  options: [
    {
      value: "cough",
      label: "Cough, cold or sore throat",
      emoji: "🤧",
      score: { "General Physician": 3 },
      conditions: ["Likely a viral infection"],
      causes: [
        { name: "Viral fever or flu", likelihood: "likely", why: "Fever with cold and cough is usually viral.", specialty: "General Physician" },
        { name: "Throat or tonsil infection", likelihood: "possible", why: "Fits if swallowing hurts most.", specialty: "ENT" },
      ],
    },
    {
      value: "tummy",
      label: "Vomiting or loose motions",
      emoji: "🤢",
      score: { "General Physician": 3 },
      conditions: ["Stomach infection"],
      urgency: "urgent",
      causes: [
        { name: "Stomach infection", likelihood: "likely", why: "Fever with vomiting or motions.", specialty: "General Physician" },
        { name: "Typhoid", likelihood: "possible", why: "Considered with sustained fever and belly upset.", specialty: "General Physician" },
      ],
    },
    {
      value: "rash",
      label: "A rash or spots",
      emoji: "🔴",
      score: { "General Physician": 3, Dermatologist: 1 },
      urgency: "urgent",
      causes: [
        { name: "Dengue or another viral fever", likelihood: "possible", why: "Fever with a rash needs dengue excluded.", specialty: "General Physician" },
        { name: "A drug or allergic reaction", likelihood: "possible", why: "Considered if a new medicine was started.", specialty: "Dermatologist" },
      ],
    },
    {
      value: "long",
      label: "High fever for 3+ days",
      emoji: "🌡️",
      score: { "General Physician": 4 },
      urgency: "urgent",
      causes: [
        { name: "Dengue, malaria or typhoid", likelihood: "possible", why: "Fever past three days needs blood tests.", specialty: "General Physician" },
        { name: "A bacterial infection needing antibiotics", likelihood: "possible", why: "Considered when fever won't settle on its own.", specialty: "General Physician" },
      ],
    },
    {
      value: "ache",
      label: "Just body ache and weakness",
      emoji: "💤",
      score: { "General Physician": 3 },
      causes: [
        { name: "Viral fever", likelihood: "likely", why: "Body ache and weakness without other clues.", specialty: "General Physician" },
      ],
    },
  ],
};

const Q_CHILD: DQuestion = {
  id: "child",
  prompt: "What's troubling your child?",
  when: (s) => has(s, "area:child"),
  options: [
    {
      value: "fever",
      label: "Fever or infection",
      emoji: "🤒",
      score: { Pediatrician: 4 },
      conditions: ["Childhood fever / infection"],
      causes: [
        { name: "Childhood viral infection", likelihood: "likely", why: "Most childhood fevers are viral and settle on their own.", specialty: "Pediatrician" },
        { name: "Ear or throat infection", likelihood: "possible", why: "A very common source of fever in children.", specialty: "Pediatrician" },
        { name: "Dengue or typhoid", likelihood: "possible", why: "Considered if the fever runs past three days.", specialty: "Pediatrician" },
      ],
    },
    {
      value: "breath",
      label: "Cough, cold or breathing",
      emoji: "😮‍💨",
      score: { Pediatrician: 4 },
      conditions: ["Child breathing / chest issue"],
      urgency: "urgent",
      causes: [
        { name: "Chest infection", likelihood: "likely", why: "Cough with fast or laboured breathing.", specialty: "Pediatrician" },
        { name: "Childhood asthma", likelihood: "possible", why: "Fits if wheezing keeps coming back.", specialty: "Pediatrician" },
      ],
    },
    {
      value: "tummy",
      label: "Vomiting or loose motions",
      emoji: "🤢",
      score: { Pediatrician: 4 },
      conditions: ["Child stomach infection"],
      urgency: "urgent",
      causes: [
        { name: "Stomach infection", likelihood: "likely", why: "The usual cause of vomiting and motions in children.", specialty: "Pediatrician" },
        { name: "Dehydration", likelihood: "possible", why: "The main risk in small children — watch for dry mouth and less urine.", specialty: "Pediatrician" },
      ],
    },
    {
      value: "skin",
      label: "Rash or skin problem",
      emoji: "🧴",
      score: { Pediatrician: 3, Dermatologist: 1 },
      conditions: ["Child skin condition"],
      causes: [
        { name: "Childhood eczema", likelihood: "likely", why: "Dry itchy patches are common in children.", specialty: "Pediatrician" },
        { name: "A viral rash", likelihood: "possible", why: "Fits if a fever came with it.", specialty: "Pediatrician" },
        { name: "Fungal or allergic skin reaction", likelihood: "possible", why: "Considered for spreading or well-defined patches.", specialty: "Dermatologist" },
      ],
    },
    {
      value: "growth",
      label: "Feeding, growth or vaccination",
      emoji: "🍼",
      score: { Pediatrician: 4 },
      conditions: ["Child growth / immunisation"],
      causes: [
        { name: "Growth and immunisation review", likelihood: "likely", why: "A routine check against the growth chart and schedule.", specialty: "Pediatrician" },
        { name: "Iron or vitamin deficiency", likelihood: "possible", why: "A common reason for poor feeding and slow growth.", specialty: "Pediatrician" },
      ],
    },
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
  Q_FEVER,
  Q_CHILD,
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
    causes: [],
    tags: [],
    urgency: "routine",
    flags: [],
    answers: [],
    askedIds: [],
  };

  // Seed text → prime scores from the keyword triage.
  if (state.seed.length >= 4) {
    const t = analyzeSymptoms(state.seed);
    if (t?.matched) {
      foldTriage(state, t);
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

/** Add a triage read's per-specialty confidence to the running scores. */
function foldTriage(s: DState, t: TriageResult) {
  for (const [sp, weight] of Object.entries(t.specialtyScores)) {
    addScore(s, sp as Specialty, weight);
  }
}
function addCondition(s: DState, c: string) {
  if (!s.conditions.includes(c)) s.conditions.push(c);
}

/** Add a candidate cause, keeping the strongest likelihood seen for it. */
function addCause(s: DState, c: DCause) {
  const key = c.name.trim().toLowerCase();
  const existing = s.causes.find((x) => x.name.trim().toLowerCase() === key);
  if (!existing) {
    s.causes.push({ ...c });
    return;
  }
  if (LIK_RANK[c.likelihood] > LIK_RANK[existing.likelihood]) {
    existing.likelihood = c.likelihood;
    existing.why = c.why ?? existing.why;
  }
}

/** Fold one option's effects into a state being built. */
function foldOption(s: DState, opt: DOption) {
  if (opt.score) for (const k in opt.score) addScore(s, k as Specialty, opt.score[k as Specialty]!);
  if (opt.conditions) opt.conditions.forEach((c) => addCondition(s, c));
  if (opt.causes) opt.causes.forEach((c) => addCause(s, c));
  if (opt.urgency) s.urgency = bump(s.urgency, opt.urgency);
  if (opt.tags) opt.tags.forEach((t) => !s.tags.includes(t) && s.tags.push(t));
  if (opt.flag) s.flags.push(opt.flag);
}

/** Record an answer and fold its effects into the running state. */
export function applyAnswer(prev: DState, q: DQuestion, opt: DOption): DState {
  const s: DState = {
    ...prev,
    scores: { ...prev.scores },
    conditions: [...prev.conditions],
    // Deep-copied: addCause mutates an existing entry's likelihood in place,
    // which would otherwise reach back into the previous state.
    causes: prev.causes.map((c) => ({ ...c })),
    tags: [...prev.tags],
    flags: [...prev.flags],
    answers: [...prev.answers, { questionId: q.id, prompt: q.prompt, value: opt.value, label: opt.label }],
    askedIds: prev.askedIds.includes(q.id) ? prev.askedIds : [...prev.askedIds, q.id],
  };
  foldOption(s, opt);
  return s;
}

/**
 * Record an answer to an AI-generated question. The model writes its own
 * option chips, so they carry no `score`/`flag`/`tags` of their own — without
 * this the local state would stay empty the whole session, meaning (a) the
 * red-flag short-circuit never fires and we'd be trusting the model alone on
 * emergencies, and (b) a mid-session fallback to the offline engine would have
 * nothing to conclude from. Running the keyword triage over the chosen label
 * keeps both safety nets alive underneath the AI.
 */
export function applyAiAnswer(prev: DState, q: DQuestion, opt: DOption): DState {
  const s = applyAnswer(prev, q, opt);
  // A scored option came from the local bank — applyAnswer already folded it.
  if (opt.score || opt.flag || opt.tags) return s;

  const t = analyzeSymptoms(`${opt.label}`);
  if (t?.matched) {
    foldTriage(s, t);
    t.conditions.forEach((c) => addCondition(s, c));
    s.urgency = bump(s.urgency, t.urgency);
    if (t.redFlags[0]) s.flags.push({ label: t.redFlags[0], sos: t.sosCategory ?? "other" });
  }
  return s;
}

/** Close the session out with what we know. Used when the AI runs past its
 *  question budget or drops out mid-flow — `nextStep` would otherwise restart
 *  the local funnel from its first question, which reads as amnesia. */
export function forceConclusion(s: DState): DConclusion {
  return conclude(s, s.flags.length > 0);
}

/** Did the patient type one of the on-screen options in words? */
function spokenOption(q: DQuestion, text: string): DOption | undefined {
  const t = text.toLowerCase().trim();
  if (t.length < 4) return undefined;
  return q.options.find((o) => {
    const label = o.label.toLowerCase();
    return t === label || t === o.value || label.startsWith(t) || t.startsWith(label);
  });
}

/**
 * Triage's read of free text → the funnel's body-area tag, so describing the
 * problem in prose picks the same branch tapping "Where's the main problem?"
 * would have, instead of dropping straight to the generic questions.
 */
function areaTagFor(t: TriageResult): string | null {
  switch (t.specialties[0]) {
    case "ENT":
    case "Neurologist":
      return "area:head";
    case "Cardiologist":
      return "area:chest";
    case "Dermatologist":
      return "area:skin";
    case "Orthopedic":
      return "area:bones";
    case "Psychiatrist":
      return "area:mind";
    case "Gynecologist":
      return "area:women";
    case "Pediatrician":
      return "area:child";
  }
  // General Physician spans several areas — split it by the matched condition.
  const c = t.conditions.join(" ").toLowerCase();
  if (/digestive|stomach/.test(c)) return "area:tummy";
  if (/breathing/.test(c)) return "area:chest";
  if (/viral|general illness/.test(c)) return "area:fever";
  return null;
}

/** Fold free-text the patient types mid-flow into the running state, so the
 *  chat box and the option chips drive the same funnel. */
export function applyText(prev: DState, text: string): DState {
  const clean = text.trim();
  const s: DState = {
    ...prev,
    scores: { ...prev.scores },
    conditions: [...prev.conditions],
    causes: prev.causes.map((c) => ({ ...c })),
    tags: [...prev.tags],
    flags: [...prev.flags],
    answers: [
      ...prev.answers,
      { questionId: "free", prompt: "You told us", value: clean, label: clean },
    ],
    askedIds: [...prev.askedIds],
  };
  // Only a real keyword hit moves the scores. Chatty follow-ups ("started
  // two days ago") fall through to the General Physician default, and
  // folding that in each time would drown the specialty the patient named.
  const t = analyzeSymptoms(clean);
  if (t?.matched) {
    foldTriage(s, t);
    t.conditions.forEach((c) => addCondition(s, c));
    s.urgency = bump(s.urgency, t.urgency);
    if (t.redFlags[0]) s.flags.push({ label: t.redFlags[0], sos: t.sosCategory ?? "other" });
  }
  if (!s.tags.includes("seeded")) s.tags.push("seeded");

  // Typing has to answer whatever is on screen, or `nextStep` keeps handing
  // back the same first unanswered question and the funnel never moves.
  const pending = nextStep(prev);
  if (pending.kind === "question") {
    const q = pending.question;
    if (!s.askedIds.includes(q.id)) s.askedIds.push(q.id);
    // Typed the option in words → score it exactly like tapping the chip;
    // otherwise fall back to whatever the question assumes for prose.
    const chosen =
      spokenOption(q, clean) ??
      q.options.find((o) => o.value === q.assumeWhenTyped);
    if (chosen) foldOption(s, chosen);
  }

  // Let what they described choose the body-area branch.
  if (t?.matched && !s.tags.some((x) => x.startsWith("area:"))) {
    const area = areaTagFor(t);
    if (area) s.tags.push(area);
  }
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

/**
 * Rank the differential: strongest likelihood first, then by how much the
 * answers pointed at that cause's specialty. Falls back to deriving causes
 * from the collected `conditions` when a branch had none of its own, so the
 * result card always has something to explain rather than a bare specialty.
 */
export function rankedCauses(s: DState): DCause[] {
  const pool = s.causes.length
    ? s.causes
    : s.conditions.map<DCause>((c) => ({
        name: c,
        likelihood: "possible",
        specialty: conditionToSpecialty(c) ?? "General Physician",
      }));

  return [...pool].sort((a, b) => {
    const byLikelihood = LIK_RANK[b.likelihood] - LIK_RANK[a.likelihood];
    if (byLikelihood !== 0) return byLikelihood;
    return scoreOf(s, b.specialty) - scoreOf(s, a.specialty);
  });
}

/** One plain-language line naming the leading possibility (never a verdict). */
function summarise(causes: DCause[]): string | undefined {
  const top = causes[0];
  if (!top) return undefined;
  const lead =
    top.likelihood === "likely"
      ? `This most likely points to ${top.name.toLowerCase()}`
      : `The most likely explanation is ${top.name.toLowerCase()}`;
  const others = causes.slice(1, 3).map((c) => c.name.toLowerCase());
  if (others.length === 0) return `${lead}. A doctor still needs to confirm it.`;
  return `${lead}, though ${others.join(" or ")} could also explain it. Only a doctor can confirm which.`;
}

function conclude(s: DState, emergency = false): DConclusion {
  const order = ranked(s);
  const causes = rankedCauses(s);
  // The differential leads, so the headline doctor is whoever treats the top
  // candidate — otherwise the card could name a specialty that no listed cause
  // actually points at. Scores still break ties inside `rankedCauses`.
  const specialty = (causes[0]?.specialty ?? order[0]?.specialty ?? "General Physician") as Specialty;
  const alt =
    causes.find((c) => c.specialty !== specialty)?.specialty ??
    (order.find((o) => o.specialty !== specialty)?.specialty as Specialty | undefined);
  const conditions = s.conditions.length
    ? s.conditions
    : causes.length
      ? causes.map((c) => c.name)
      : ["General consultation"];

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
      // Phrased so the flag label is never the grammatical subject — labels are
      // a mix of singular and plural ("Severe bleeding", "Heart-attack signs")
      // and interpolating them before a verb gets the agreement wrong.
      summary: `This needs emergency assessment right now, not an appointment${flag?.label ? ` — ${flag.label.toLowerCase()}` : ""}.`,
      causes: [
        {
          name: flag?.label ?? "Possible emergency",
          likelihood: "likely",
          why: "Reported as happening right now.",
          specialty,
        },
        ...causes.filter((c) => c.name !== flag?.label),
      ],
      advice:
        "This looks like it could be an emergency. Get help immediately — call your local emergency number or go to the nearest hospital.",
    };
  }

  const advice =
    s.urgency === "urgent"
      ? `Best seen soon by a ${specialty}. Book a home visit or video call below — seek emergency care if it gets worse.`
      : `A ${specialty} is a good fit for this. Book a visit whenever you're ready.`;

  return {
    kind: "conclusion",
    urgency: s.urgency,
    specialty,
    alt,
    conditions,
    emergency: false,
    summary: summarise(causes),
    causes,
    advice,
  };
}

/** Loose reverse-map so history conditions can nudge scores. */
function conditionToSpecialty(c: string): Specialty | null {
  const t = c.toLowerCase();
  if (/heart|cardiac|palpitation/.test(t)) return "Cardiologist";
  if (/skin/.test(t)) return "Dermatologist";
  if (/bone|joint|muscle/.test(t)) return "Orthopedic";
  if (/migraine|nerve|neuro|seizure|epilep|tremor|numbness|paralys|stroke/.test(t))
    return "Neurologist";
  if (/ear|nose|throat|sinus/.test(t)) return "ENT";
  if (/mental|stress|anxiety|mood/.test(t)) return "Psychiatrist";
  if (/gyn|pregnan|period/.test(t)) return "Gynecologist";
  if (/child/.test(t)) return "Pediatrician";
  if (/stomach|digest|infection|viral|general/.test(t)) return "General Physician";
  return null;
}
