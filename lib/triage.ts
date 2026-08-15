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

  /**
   * ── The same red flags in Hindi and Marathi ──
   *
   * Not a nicety. The checker invites people to answer in their own language,
   * and every rule above is an English regex: without these, a patient typing
   * "छाती में दर्द और पसीना" matched NOTHING, so the safety floor in the
   * diagnose route never fired and a heart attack came back as whatever the
   * model felt like saying. A triage net that only catches English is not a
   * net for the people this product is built for.
   *
   * Written WITHOUT \b — the boundary class is [A-Za-z0-9_], so it does not
   * mean anything next to Devanagari and only ever fails the match. Spelling
   * varies more than in English (ज़/ज, साँस/सांस, स्ट्रोक/लकवा), so each
   * pattern is deliberately loose: a false positive costs one unnecessary
   * "go now", a false negative costs what it always costs.
   */
  { test: /साँस नहीं|सांस नहीं|साँस नही|दम घुट|दम घुट रहा|श्वास नाही|श्वास बंद|साँस रुक|सांस रुक/, label: "Not breathing", sos: "respiratory" },
  { test: /बेहोश|बेशुद्ध|होश नहीं|होश नाही|शुद्ध हरप|अचेत/, label: "Unconscious", sos: "other" },
  { test: /(छाती|सीने|छातीत|छातीमध्ये).{0,25}(दर्द|दुख|पीड़ा|वेदना).{0,25}(पसीन|घाम|बांह|बाजू|जबड़|जबडा|सांस|साँस|श्वास)|हार्ट अटैक|दिल का दौरा|हृदयविकाराचा झटका|हृदयाघात/, label: "Heart-attack signs", sos: "cardiac" },
  { test: /लकवा|पक्षाघात|अर्धांगवायू|चेहरा टेढ़ा|तोंड वाकड|बोली लड़खड़ा|बोलणे अडख|स्ट्रोक/, label: "Stroke signs", sos: "stroke" },
  { test: /बहुत खून|खूप रक्त|खून बह रहा|रक्त वाहत|खून रुक नहीं|रक्तस्राव|रक्तस्त्राव|खून बंद नहीं/, label: "Severe bleeding", sos: "trauma" },
  { test: /मिर्गी|मिरगी|दौरा पड़|झटके आ|फेफरे|आकडी|अपस्मार/, label: "Seizure", sos: "other" },
  { test: /गला बंद|गळा बंद|निगल नहीं|गिळता येत नाही|गले में सूजन|जीभ सूज|एलर्जी.{0,15}(गंभीर|तीव्र)/, label: "Choking / severe allergy", sos: "respiratory" },
  { test: /आत्महत्या|जान देना|मरना चाहता|मरून जाव|खुद को नुकसान|स्वतःला इजा/, label: "Self-harm risk", sos: "other" },
  { test: /ज़हर|जहर खा|विष खा|विषबाधा|गोलियां खा ली|गोळ्या खाल्ल्या|ओवरडोज/, label: "Poisoning / overdose", sos: "other" },
  { test: /एक्सीडेंट|दुर्घटना|अपघात|गंभीर चोट|गंभीर जखम|हिल नहीं|हलता येत नाही/, label: "Serious injury", sos: "trauma" },
  { test: /प्रसव|प्रसूती|पानी की थैली|पाणी गेल|बच्चा होने वाला|बाळंतपण/, label: "Childbirth", sos: "obstetric" },
  { test: /साँप ने काटा|सांप ने काटा|सर्पदंश|साप चावला|बिच्छू|विंचू/, label: "Snake or scorpion bite", sos: "other" },
  { test: /खून की उल्टी|उल्टी में खून|रक्ताची उलटी|उलटीत रक्त|काला पखाना|काळे शौच|मल में खून|शौचातून रक्त/, label: "Bleeding from the gut", sos: "other" },
  { test: /(बहुत तेज़|बहुत तेज|अचानक तीव्र|असह्य).{0,15}(सिरदर्द|सिर दर्द|डोकेदुखी)|जिंदगी का सबसे तेज सिरदर्द/, label: "Sudden severe headache", sos: "stroke" },
  { test: /(पेट).{0,20}(असहनीय|बहुत तेज़|बहुत तेज|तीव्र).{0,10}(दर्द|दुख|वेदना)|पेशाब नहीं|लघवी होत नाही|मूत्र नहीं आ/, label: "Severe abdominal problem", sos: "other" },
  { test: /(बच्चा|बाळ|शिशु|नवजात).{0,25}(दूध नहीं|दूध पीत नाही|सुस्त|उठ नहीं|जागत नाही|निढाल)/, label: "Sick infant", sos: "other" },
  { test: /(गर्भ|प्रेग्नन्ट|प्रेग्नेंट|गरोदर).{0,25}(खून|रक्त|ब्लीडिंग)|(खून|रक्त).{0,25}(गर्भ|गरोदर)|बच्चा हिल नहीं|बाळाची हालचाल बंद/, label: "Pregnancy emergency", sos: "obstetric" },
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
        ? // "an ENT", not "a ENT". The specialty list is closed and holds no
          // awkward cases, so the first letter settles it.
          `Best seen soon by ${/^[AEIOU]/i.test(specialties[0]) ? "an" : "a"} ${specialties[0]}. If it gets worse, seek emergency care.`
        : `${/^[AEIOU]/i.test(specialties[0]) ? "An" : "A"} ${specialties[0]} is a good fit. Book a visit below.`,
  };
}

// ── Is this a complaint at all? ─────────────────────────────

/**
 * The words people actually open with.
 *
 * SEPARATE from the specialty rules above, and deliberately so. Those rules
 * exist to route — they answer "which doctor", and they are written to fire on
 * phrases with enough context to be confident ("severe bleeding", "bleeding
 * heavily"). This list answers a much cheaper question: has this person told
 * us about a symptom at all?
 *
 * That distinction is not academic. A patient typed "bleeding", matched no
 * routing rule, reached the model with a single word, and was answered with
 * "Hi! What's troubling you today?" — after they had just said. The router was
 * right to be unsure which specialty; the app was wrong to conclude they had
 * said nothing.
 *
 * So this is broad on purpose. A false positive costs one triage question. A
 * false negative asks a worried person to repeat themselves, which is the
 * failure they actually notice and the one that makes the tool feel stupid.
 */
const SYMPTOM_WORDS =
  /\b(pain|ache|aching|hurt|hurts|hurting|sore|soreness|fever|temperature|chills|cold|cough|coughing|sneez\w*|breath\w*|breathless|wheez\w*|bleed\w*|blood|bruise\w*|swell\w*|swollen|lump|rash|itch\w*|burn\w*|sting\w*|numb\w*|tingl\w*|weak\w*|tired\w*|fatigue|exhaust\w*|dizzy|dizziness|faint\w*|giddy|nausea|nauseous|vomit\w*|puk\w*|diarrh\w*|loose motion\w*|constipat\w*|gas|bloat\w*|acidity|heartburn|indigest\w*|cramp\w*|spasm|stiff\w*|sprain\w*|fracture|injur\w*|wound|cut|burnt|infect\w*|discharge|pus|boil|ulcer|blister|headache|migraine|vertigo|seizure|fit|fits|unconscious|confus\w*|memory|insomnia|sleepless|sleep|anxiety|anxious|depress\w*|stress\w*|panic|mood|appetite|weight loss|weight gain|thirsty|urin\w*|pee|peeing|stool|motion|period|periods|menstru\w*|pregnan\w*|discharge|erectile|infertil\w*|vision|blurred|eyesight|hearing|deaf\w*|tinnitus|earache|throat|tonsil\w*|toothache|gum|mouth|tongue|skin|hair fall|hairfall|dandruff|acne|pimple\w*|allerg\w*|asthma|diabet\w*|sugar|bp|pressure|palpitation\w*|heart|chest|stomach|belly|abdomen|tummy|back|neck|shoulder|knee|joint\w*|muscle|leg|arm|hand|foot|feet|head|eye|ear|nose|liver|kidney|piles|hemorrhoid\w*|fissure|hernia|thyroid|anemia|anaemia|jaundice|typhoid|malaria|dengue|covid|flu|viral|infection|unwell|sick|ill|illness|not feeling well|feeling low)\b/i;

/**
 * Has the patient described a health problem yet?
 *
 * Used by the triage API to settle the question in CODE before the model sees
 * the transcript, so a one-word complaint can never be mistaken for small talk.
 * Greetings and app questions are excluded explicitly — "hello" and "how does
 * this work" are the two things people genuinely do open with that are not
 * complaints.
 */
/**
 * The same question in Devanagari.
 *
 * Kept separate from SYMPTOM_WORDS because \b cannot delimit Devanagari (the
 * word-boundary class is ASCII), so these have to match as bare substrings —
 * which is fine here: Hindi and Marathi share most of this vocabulary, and a
 * substring hit on "दर्द" or "ताप" is exactly as much evidence as "pain" is.
 * Without it every Hindi complaint read as small talk and the model was told
 * to ask "what's troubling you?" to someone who had just said.
 */
const SYMPTOM_WORDS_DEV =
  /दर्द|दुखत|दुखणे|वेदना|पीड़ा|बुखार|ताप|थंडी|खांसी|खोकला|सर्दी|जुकाम|छींक|शिंक|साँस|सांस|श्वास|दम|खून|रक्त|सूजन|सूज|गाँठ|गाठ|चकत्ते|पुरळ|खुजली|खाज|जलन|आग|सुन्न|बधिर|झुनझुनी|मुंग्या|कमजोर|अशक्त|थकान|थकवा|चक्कर|भोवळ|बेहोश|मळमळ|उल्टी|उलटी|दस्त|जुलाब|संडास|कब्ज|बद्धकोष्ठ|गैस|गॅस|अपच|एसिडिटी|मरोड|पेटके|अकड|मोच|फ्रैक्चर|चोट|जखम|घाव|जख्म|संक्रमण|इन्फेक्शन|पस|फोड़ा|छाला|अल्सर|सिरदर्द|सिर दर्द|डोकेदुखी|माइग्रेन|मायग्रेन|मिर्गी|दौरा|नींद|झोप|अनिद्रा|चिंता|तणाव|तनाव|घबराहट|उदास|नैराश्य|डिप्रेशन|भूख|वजन|प्यास|तहान|पेशाब|लघवी|मूत्र|मल|शौच|पीरियड|मासिक|पाळी|गर्भ|गरोदर|प्रेग्नन्ट|नज़र|नजर|दृष्टी|दिखाई|दिसत नाही|धुंधला|सुनाई|ऐकू|कान|कानदुखी|गला|घसा|टॉन्सिल|दांत|दात|मसूड़|हिरड|मुंह|तोंड|जीभ|त्वचा|कातडी|बाल गिर|केस गळ|कोंडा|मुँहासे|पिंपल|एलर्जी|ॲलर्जी|दमा|अस्थमा|मधुमेह|डायबिटीज|शुगर|साखर|बीपी|रक्तदाब|दबाव|धड़कन|ठोके|हृदय|दिल|छाती|छातीत|सीने|पेट|पोट|पोटात|कमर|कंबर|पाठ|पीठ|गर्दन|मान|कंधा|खांदा|घुटन|गुडघ|जोड़|सांध|मांसपेशी|स्नायू|पैर|पाय|हाथ|हात|सिर|डोक|डोळ|आँख|आंख|नाक|लिवर|यकृत|किडनी|मूत्रपिंड|बवासीर|मूळव्याध|फिशर|हर्निया|थायरॉ|खून की कमी|अ‍ॅनिमिया|एनीमिया|पीलिया|कावीळ|टाइफाइड|मलेरिया|हिवताप|डेंगू|कोविड|फ्लू|वायरल|व्हायरल|तबीयत|तब्येत|बीमार|आजारी|अस्वस्थ|बरं वाटत नाही|ठीक नहीं|बरे नाही/;

export function mentionsSymptom(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 2) return false;
  // Devanagari first: a Hindi/Marathi greeting is caught by the list below in
  // its own script, so there is no risk of "नमस्ते" reading as a complaint.
  if (/^(नमस्ते|नमस्कार|हाय|हॅलो|हैलो|ठीक|धन्यवाद|शुक्रिया|आभारी)[\s!.,।]*$/.test(t)) {
    return false;
  }
  if (SYMPTOM_WORDS_DEV.test(t)) return true;
  // A pure greeting or a question about the product is not a complaint, even
  // if a body word slips into it ("hi, how does this app work?").
  if (/^(hi|hey|hello|namaste|namaskar|hola|yo|test+|ok|okay|thanks?|thank you)\b[\s!.,]*$/i.test(t)) {
    return false;
  }
  if (/\b(how (do|does|can)|what is this|who are you|are you (a )?(bot|real|doctor))\b/i.test(t)) {
    return false;
  }
  return SYMPTOM_WORDS.test(t) || (analyzeSymptoms(t)?.matched ?? false);
}
