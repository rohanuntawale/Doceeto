/**
 * Symptom triage — a fast, deterministic keyword engine (no network, no
 * latency) that maps free-text symptoms to a likely specialty, a plain-
 * language read of what might be happening, an urgency level, and — most
 * importantly for a platform built around emergencies — red-flag
 * detection that tells the patient to hit SOS.
 *
 * It maps ONLY to specialties a doctor can register with, defaulting to
 * a General Physician, so every suggestion is bookable.
 */
import type { SosCategory } from "@/lib/types/domain";

export type Urgency = "emergency" | "urgent" | "routine";

export interface TriageResult {
  urgency: Urgency;
  /** Ranked, bookable specialties (most-likely first). */
  specialties: string[];
  /** Plain-language possibilities — NOT a diagnosis. */
  conditions: string[];
  advice: string;
  /** Matched emergency signals, if any. */
  redFlags: string[];
  /** Best SOS category when this is an emergency. */
  sosCategory?: SosCategory;
  /**
   * True when a rule or red flag actually fired. False means this is only
   * the General Physician fallback — callers that accumulate scores across
   * several messages must not let that outweigh a real match.
   */
  matched: boolean;
  /**
   * Specialty → how strongly the text points at it. Callers should score
   * from this rather than the `specialties` order, so a focused match
   * ("hair fall") outranks a catch-all one that happened to fire too.
   */
  specialtyScores: Record<string, number>;
}

interface Rule {
  test: RegExp;
  specialty: string;
  conditions: string[];
  urgency: Urgency;
  /**
   * Confidence this rule's hit gives. Body-system rules outrank the broad
   * General Physician catch-alls, and age beats body system — a toddler
   * with a rash is a paediatric visit first, a skin one second.
   */
  weight: number;
}

/**
 * Patients describe symptoms in their own words, so each pattern covers the
 * everyday phrasings — not just the clinical term. Anything these miss falls
 * through to the General Physician default, which is safe but vague, so gaps
 * here are what make a recommendation feel wrong.
 */
const RULES: Rule[] = [
  {
    // Age trumps body system: route the child first, the organ second.
    test: /\b(child|children|baby|babies|infant|toddler|kid|kids|son|daughter|newborn)\b|vaccinat|immunis|immuniz/,
    specialty: "Pediatrician",
    conditions: ["Child health concern"],
    urgency: "routine",
    weight: 5,
  },
  {
    // Proximity rather than exact phrases — "chest feels tight when I climb
    // stairs" is how people actually describe it.
    test: /chest\b.{0,20}\b(pain|tight|heavy|heaviness|pressure|discomfort)|\b(pain|tight|tightness|pressure|heaviness).{0,20}\bchest\b|palpitat|angina|cardiac|heart attack|heart\b.{0,15}\b(racing|races|pounding|pounds|fluttering|flutters|skipping|skips|fast)|racing heart|rapid heart|heart ?beat|blood pressure|\bbp\b|hypertens|cholesterol/,
    specialty: "Cardiologist",
    conditions: ["Possible heart-related problem"],
    urgency: "urgent",
    weight: 4,
  },
  {
    test: /pregnan|in labour|labor pain|period|menstru|vaginal|gynae|pcos|pcod|miscarriage|menopaus|white discharge|infertil|uterus|ovar(y|ian|ies)|breast/,
    specialty: "Gynecologist",
    conditions: ["Gynaecological / pregnancy-related concern"],
    urgency: "routine",
    weight: 4,
  },
  {
    test: /fractur|broken bone|dislocat|sprain|ligament|arthrit|joint|knee|back pain|neck pain|stiff|shoulder|spine|spondyl|slip(ped)? disc|cervical|bone|muscle (pain|ache)|swollen (ankle|wrist|knee|foot|leg)|limp/,
    specialty: "Orthopedic",
    conditions: ["Bone / joint / muscle problem"],
    urgency: "routine",
    weight: 4,
  },
  {
    test: /rash|itch|acne|pimple|eczema|hives|\bmole\b|skin|psorias|fungal|hair ?(fall|loss|thin)|losing hair|bald|dandruff|\bnails?\b|\bboils?\b|wart|pigment|(dark|white|red|black) (spots?|patch(es)?)|patches on|blackhead|whitehead/,
    specialty: "Dermatologist",
    conditions: ["Skin condition"],
    urgency: "routine",
    weight: 4,
  },
  {
    test: /\b(ears?|hearing|sinus|tonsils?|nosebleed|adenoid)\b|nose bleed|ear ?ache|sore throat|throat pain|throat infection|tonsillit|sneez|nose\b.{0,15}\b(block|blocked|stuff|stuffed|congest)|\b(block|blocked|stuff|stuffy|congest)\w*\s+nose|hearing loss|snor(e|ing)|hoarse|voice/,
    specialty: "ENT",
    conditions: ["Ear / nose / throat issue"],
    urgency: "routine",
    weight: 4,
  },
  {
    test: /anxiety|anxious|depress|panic|stress|can'?t sleep|cannot sleep|sleepless|insomnia|mental|feeling low|low mood|hopeless|mood swing|overthink|addict/,
    specialty: "Psychiatrist",
    conditions: ["Mental-health / stress concern"],
    urgency: "routine",
    weight: 4,
  },
  {
    // Brain and nerves. "fits"/"stroke" are also red flags below, which
    // overrides the urgency — this only settles WHO they should see.
    test: /migraine|seizure|convuls|epilep|\bfits\b|tremor|shaking hands|parkinson|numbness|numb\b|tingl|pins and needles|paralys|weak(ness)? (on )?one side|vertigo|giddi(ness)?|giddy|blackout|memory loss|forgetful|dementia|\bnerve|neuro|slurred speech|face droop|stroke/,
    specialty: "Neurologist",
    conditions: ["Nerve / brain-related symptom"],
    urgency: "urgent",
    weight: 4,
  },
  {
    test: /breath|breathless|short of breath|asthma|wheez|suffocat|inhaler/,
    specialty: "General Physician",
    conditions: ["Breathing difficulty"],
    urgency: "urgent",
    weight: 3,
  },
  {
    test: /stomach|abdomen|belly|tummy|vomit|nausea|diarr|loose motion|constipat|acidity|indigest|\bgas\b|bloat|piles|ulcer|appetite|jaundice/,
    specialty: "General Physician",
    conditions: ["Digestive / stomach problem"],
    urgency: "routine",
    weight: 3,
  },
  {
    test: /fever|cough|cold\b|flu\b|running nose|runny nose|body ache|chills|weak|fatigue|tired|headache|migraine|dizzy|dizziness|diabet|sugar|thyroid|infection/,
    specialty: "General Physician",
    conditions: ["Likely a viral infection or general illness"],
    urgency: "routine",
    weight: 2,
  },
];

interface Flag {
  test: RegExp;
  label: string;
  sos: SosCategory;
}

// Any of these overrides urgency to "emergency".
const RED_FLAGS: Flag[] = [
  { test: /can'?t breathe|not breathing|stopped breathing|no pulse/, label: "Not breathing", sos: "respiratory" },
  { test: /unconscious|unrespons|passed out|fainted and not/, label: "Unconscious", sos: "other" },
  { test: /chest pain.*(breath|sweat|left arm|jaw)|heart attack/, label: "Heart-attack signs", sos: "cardiac" },
  { test: /stroke|face droop|slurred speech|sudden weakness|numb (face|arm|side)/, label: "Stroke signs", sos: "stroke" },
  { test: /severe bleeding|bleeding heavily|won'?t stop bleeding|blood loss/, label: "Severe bleeding", sos: "trauma" },
  { test: /seizure|convuls|fits\b/, label: "Seizure", sos: "other" },
  { test: /chok|can'?t swallow|swelling.*(throat|tongue)|anaphyla|severe allergic/, label: "Choking / severe allergy", sos: "respiratory" },
  { test: /suicid|kill myself|end my life|harm myself/, label: "Self-harm risk", sos: "other" },
  { test: /overdose|poison|swallowed (pills|chemical)/, label: "Poisoning / overdose", sos: "other" },
  { test: /major accident|hit by|road accident|serious injury|can'?t move/, label: "Serious injury", sos: "trauma" },
  { test: /labour|water broke|delivering/, label: "Childbirth", sos: "obstetric" },

  /**
   * Time-critical presentations the original list missed. Triage is a
   * deliberately ASYMMETRIC problem: sending someone to hospital who did not
   * need it costs an afternoon, missing one of these can cost a life or an
   * organ. Every pattern below is a "go now" that a keyword engine can catch
   * with high confidence, so each is worth the occasional false positive.
   */
  // Subarachnoid haemorrhage — the phrasing is famously distinctive.
  { test: /worst (headache|head ?ache) (of my life|ever)|thunderclap|sudden(est)? severe head ?ache/, label: "Sudden severe headache", sos: "stroke" },
  // Meningitis: the non-blanching rash is the one sign laypeople are taught.
  { test: /stiff neck.*(fever|light)|neck stiff.*(fever|light)|rash.*(doesn'?t|does not|won'?t) fade|glass test/, label: "Possible meningitis", sos: "other" },
  // Upper and lower GI bleeding.
  { test: /vomit(ing)? blood|blood in (my )?vomit|coffee ground|black (tarry )?stool|blood in (my )?stool|passing blood/, label: "Bleeding from the gut", sos: "other" },
  // Surgical abdomen / obstruction.
  { test: /severe (stomach|abdominal|belly) pain|abdomen.{0,15}rigid|can'?t (pass|pee|urinate)|not passed urine/, label: "Severe abdominal problem", sos: "other" },
  // Testicular torsion — a six-hour window to save the testicle.
  { test: /testic(le|ular).{0,20}(pain|swollen|swelling)|scrotum.{0,15}pain/, label: "Sudden testicular pain", sos: "other" },
  // Acute vision loss — retinal artery occlusion / detachment.
  { test: /sudden(ly)? (lost|loss of|can'?t see|blurred).{0,15}(vision|sight)|curtain over (my )?(eye|vision)/, label: "Sudden vision loss", sos: "other" },
  // Obstetric emergencies.
  { test: /(bleeding|blood).{0,25}pregnan|pregnan.{0,25}(bleeding|blood)|baby.{0,20}(not moving|stopped moving)|reduced (fetal |foetal )?movement/, label: "Pregnancy emergency", sos: "obstetric" },
  // The infant signs that matter, in the words a parent would use.
  { test: /(baby|infant|newborn|child).{0,30}(not feeding|refus(ing|es) (to )?feed|floppy|limp|won'?t wake|not waking|grunting)/, label: "Sick infant", sos: "other" },
  // Environmental.
  { test: /snake ?bite|bitten by a snake|scorpion sting/, label: "Snake or scorpion bite", sos: "other" },
  { test: /burn(t|ed)?.{0,20}(badly|severe|large|boiling|acid)|electric shock|electrocut/, label: "Serious burn or shock", sos: "trauma" },
  // Sepsis-ish: the combination is what makes it urgent, not either alone.
  { test: /(high fever|very high temperature).{0,30}(confus|drowsy|shiver|rigor)|fever.{0,20}(not waking|unrespons)/, label: "Possible severe infection", sos: "other" },
  // Diabetic emergency.
  { test: /sugar.{0,15}(very (high|low)|too (high|low))|hypo(glycemi|glycaemi)|ketoacidos|breath smells sweet/, label: "Diabetic emergency", sos: "other" },
];

const RANK: Record<Urgency, number> = { routine: 0, urgent: 1, emergency: 2 };

/** Analyze free-text symptoms. Returns null if there's nothing to read yet. */
export function analyzeSymptoms(input: string): TriageResult | null {
  const text = input.toLowerCase().trim();
  if (text.length < 4) return null;

  const redFlags: string[] = [];
  let sosCategory: SosCategory | undefined;
  for (const f of RED_FLAGS) {
    if (f.test.test(text)) {
      redFlags.push(f.label);
      sosCategory ??= f.sos;
    }
  }

  // Rank by the strongest rule that fired for each specialty, not by the
  // order the rules happen to sit in.
  const hits = new Map<string, number>();
  const conditions: string[] = [];
  let urgency: Urgency = "routine";
  for (const r of RULES) {
    if (r.test.test(text)) {
      hits.set(r.specialty, Math.max(hits.get(r.specialty) ?? 0, r.weight));
      for (const c of r.conditions) if (!conditions.includes(c)) conditions.push(c);
      if (RANK[r.urgency] > RANK[urgency]) urgency = r.urgency;
    }
  }

  const specialties = [...hits.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([specialty]) => specialty);
  const specialtyScores = Object.fromEntries(hits);

  const matched = specialties.length > 0 || redFlags.length > 0;
  if (specialties.length === 0) {
    specialties.push("General Physician");
    conditions.push("General consultation");
  }

  if (redFlags.length > 0) {
    urgency = "emergency";
    return {
      urgency,
      specialties,
      conditions,
      redFlags,
      matched,
      specialtyScores,
      sosCategory: sosCategory ?? "other",
      advice:
        "This looks like it could be a medical emergency. Get help immediately — call your local emergency number or go to the nearest hospital.",
    };
  }

  return {
    urgency,
    specialties,
    conditions,
    redFlags,
    matched,
    specialtyScores,
    advice:
      urgency === "urgent"
        ? `Best seen soon by a ${specialties[0]}. If it gets worse, seek emergency care.`
        : `A ${specialties[0]} is a good fit. Book a visit below.`,
  };
}
