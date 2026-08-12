/**
 * Content filter for everything a person types into the social layer: posts,
 * comments, direct messages and channel messages.
 *
 * WHY IT EXISTS. Any app carrying user-generated content has to show a
 * proactive filter alongside a way to report and a way to block (Apple's
 * guideline 1.2 asks for all three, and this module ships all three). It is a
 * floor, not moderation — it stops the obvious, and the report queue handles
 * the rest.
 *
 * WHY IT IS A HARDCODED LIST. No dependency, no network call, no model: this
 * runs on the write path of every message, and a filter that can be slow or
 * unavailable is a filter that eventually gets skipped.
 *
 * ── Two details that are easy to get wrong and expensive to ship wrong ──
 *
 * 1. WORD BOUNDARIES. Without `\b` the list rejects "classify", "assess",
 *    "Scunthorpe" and "analgesic". On a clinical network that is not a curio:
 *    "assessment" appears in roughly every second post.
 *
 * 2. NO GLOBAL FLAG ON THE TEST REGEX. A `/g` regex keeps `lastIndex` between
 *    calls, so the same string tests true, then false, then true. Reusing one
 *    for both jobs is why filters mysteriously pass every other message. The
 *    test pattern here has no `/g`; the masking pattern is built separately.
 *
 * ── What is deliberately NOT on the list ──
 *
 * Homographs with an innocent reading, because a false rejection on a medical
 * network is worse than a miss. Clinical vocabulary is the obvious case
 * (anatomy, "rectal", "penetration", "erection"), and so are the everyday
 * homographs: "cock" (a tap, a rooster), "dyke" (a levee, and a surname),
 * "spic" (in "spic and span"), "fag" (a British cigarette). None are here.
 */

/**
 * Slurs and unambiguous profanity. Kept short on purpose — every entry is a
 * word with no legitimate reading in a professional message, and a longer list
 * is mostly a longer list of false positives.
 */
const BLOCKED = [
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "bastard",
  "asshole",
  "arsehole",
  "dickhead",
  "cunt",
  "twat",
  "wanker",
  "slut",
  "whore",
  "retard",
  "retarded",
  "nigger",
  "nigga",
  "chink",
  "coon",
  "kike",
  "wetback",
  "tranny",
  "faggot",
  "paki",
  "raghead",
  "gook",
];

/** `\b(a|b|c)\b` — one alternation, so the cost is one pass over the text. */
const PATTERN = `\\b(${BLOCKED.join("|")})\\b`;

/** No `/g`: this one is only ever asked a yes/no question. */
const TEST_RE = new RegExp(PATTERN, "i");

/**
 * Does this text contain something the app will not publish?
 *
 * Leetspeak is normalized first — `f*ck`, `sh1t` and `a$$hole` are the same
 * word to a reader, and a filter that only catches the literal spelling mostly
 * teaches people to add a digit.
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  return TEST_RE.test(normalize(text));
}

/**
 * Fold the common substitutions back to letters before testing. Applied only
 * to the copy being TESTED — the stored text is always what the author wrote.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    // Separators inserted between letters to dodge the pattern: f.u.c.k,
    // f-u-c-k, f u c k. Collapsed only BETWEEN single letters so ordinary
    // punctuation and spacing survive.
    .replace(/(?<=\b\w)[\s._*-]+(?=\w\b)/g, "");
}

/**
 * The same text with blocked words masked. Not used on the write path — the
 * app rejects rather than silently rewrites, because quietly changing what
 * someone said is its own kind of wrong — but it is what an ops moderation
 * view should render a reported message with.
 */
export function filterProfanity(text: string): string {
  if (!text) return text;
  // Fresh regex per call, so no `lastIndex` is carried anywhere.
  return text.replace(new RegExp(PATTERN, "gi"), (word) => "*".repeat(word.length));
}

/** The message shown when a write is refused. Same wording everywhere. */
export const PROFANITY_MESSAGE =
  "That message breaks the community guidelines. Please rephrase it and try again.";
