/**
 * The social layer's rules: length caps, deterministic ids, upload limits,
 * mention parsing and the curated community set.
 *
 * Pure and dependency-free so both the API routes and the browser can hold the
 * same limits — the client greys out "Post" at POST_MAX and the server refuses
 * past it, and neither is guessing what the other does.
 */

import type { PostType } from "@/lib/social/types";

// ── Length caps ─────────────────────────────────────────────
// Every one of these is enforced server-side. The client uses them for
// counters and disabled buttons; that is a courtesy, not the boundary.

export const POST_MAX = 3000;
export const COMMENT_MAX = 1000;
export const MESSAGE_MAX = 4000;
export const STORY_CAPTION_MAX = 200;
export const POLL_QUESTION_MAX = 200;
export const POLL_OPTION_MAX = 80;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const MILESTONE_TITLE_MAX = 120;
export const MILESTONE_DESC_MAX = 400;
export const TAG_MAX = 24;
export const MAX_TAGS = 5;
export const MAX_IMAGES = 4;
export const COMMUNITY_NAME_MAX = 60;
export const COMMUNITY_DESC_MAX = 300;
export const CHANNEL_NAME_MAX = 40;
export const REPORT_REASON_MAX = 200;
export const REPORT_DETAILS_MAX = 2000;
export const MAX_ATTACHMENTS = 10;

/** How many posts one feed page holds. */
export const FEED_PAGE_SIZE = 30;
/** How many of a post's newest comments ride along in the feed payload. */
export const COMMENT_PREVIEW = 3;
export const MESSAGE_PAGE_SIZE = 50;
export const NOTIFICATION_PAGE_SIZE = 50;
export const STORY_LIMIT = 60;

/** Stories are visible for exactly this long, measured at read time. */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

// ── Uploads ─────────────────────────────────────────────────
/**
 * What may be uploaded, and how big.
 *
 * Bytes live in `social_media` rather than an object store: this app has no
 * bucket, and giving it one would mean a second set of credentials, a second
 * thing to back up, and orphaned files whenever a row is deleted. Postgres
 * already has the transaction and the cascade. The cost is that the limits
 * below are real limits rather than a formality — hence the modest video cap.
 */
export const UPLOAD_LIMITS: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 10 * 1024 * 1024,
  audio: 6 * 1024 * 1024,
};

export type MediaKind = "image" | "video" | "document" | "audio";

const DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

/**
 * Which bucket a file falls into, from its MIME type alone.
 *
 * Allowlisted, not sniffed from the extension: the extension is whatever the
 * uploader typed, and `application/*` as a blanket rule would accept
 * executables. Anything unrecognised is refused rather than filed as an image.
 */
export function mediaKindOf(mime: string): MediaKind | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  if (m === "image/jpeg" || m === "image/png" || m === "image/webp" || m === "image/gif") {
    return "image";
  }
  if (m === "video/mp4" || m === "video/webm" || m === "video/quicktime") return "video";
  if (m === "audio/mpeg" || m === "audio/webm" || m === "audio/ogg" || m === "audio/mp4") {
    return "audio";
  }
  if (DOCUMENT_MIMES.has(m)) return "document";
  return null;
}

/** "1.4 MB" — what a document chip shows. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "PDF", "DOCX" — the badge on a document chip. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase().slice(0, 5) : "FILE";
}

/** Where the bytes are served from. Ids are random, so this URL is immutable. */
export const mediaUrl = (id: string): string => `/api/social/media/${id}`;

// ── Post typing ─────────────────────────────────────────────

/**
 * A post's type is DERIVED from what is actually attached, never taken from
 * the client. Sending `type: "milestone"` with no milestone would otherwise
 * render an empty celebration card, and a text post could claim to be a poll.
 *
 * Order matters: images beat video beat poll beat milestone beat document,
 * matching how the card decides what to render first.
 */
export function inferPostType(input: {
  imageIds?: string[];
  videoId?: string | null;
  poll?: unknown;
  milestone?: unknown;
  documentId?: string | null;
}): PostType {
  if (input.imageIds?.length) return "image";
  if (input.videoId) return "video";
  if (input.poll) return "poll";
  if (input.milestone) return "milestone";
  if (input.documentId) return "document";
  return "text";
}

// ── Deterministic ids ───────────────────────────────────────

/**
 * A DM thread's id is its participants, sorted and joined.
 *
 * This is not a shortcut — it removes a whole class of bug. "Get or create the
 * conversation with this person" becomes one upsert, so two devices opening
 * the same thread at the same moment cannot produce two threads with half the
 * history in each.
 */
export function conversationIdFor(participantIds: string[]): string {
  return [...new Set(participantIds)].sort().join("_");
}

/** UTC calendar day, the granularity every engagement metric counts at. */
export function dayKey(at: number | Date = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}

/**
 * An engagement event's id IS its identity: kind, whose it is, which post,
 * who did it, and the day. Recording becomes an upsert that does nothing on
 * conflict, so opening the same profile fifty times in an afternoon is fifty
 * writes and one counted view — with no read-then-write, and therefore nothing
 * for two concurrent requests to race over.
 */
export function engagementEventId(
  type: string,
  ownerId: string,
  actorId: string,
  postId: string | null,
  day: string,
): string {
  return `${type}|${ownerId}|${postId ?? "-"}|${actorId}|${day}`;
}

// ── Text handling ───────────────────────────────────────────

/** Trim, collapse runaway blank lines, and cap. Returns "" for non-strings. */
export function clean(raw: unknown, cap: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\n{4,}/g, "\n\n\n").trim().slice(0, cap);
}

/** A short preview of a post — for notifications and share messages. */
export function excerpt(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * Hashtags, normalized. Accepts them typed into the body as well as picked
 * from the composer, because people type them either way.
 */
export function extractTags(content: string, explicit: unknown): string[] {
  const fromBody = content.match(/#([\p{L}\p{N}_-]{2,})/gu)?.map((t) => t.slice(1)) ?? [];
  const fromClient = Array.isArray(explicit) ? explicit.map((t) => String(t)) : [];
  const all = [...fromClient, ...fromBody]
    .map((t) => t.trim().toLowerCase().replace(/^#/, "").slice(0, TAG_MAX))
    .filter(Boolean);
  return [...new Set(all)].slice(0, MAX_TAGS);
}

/**
 * Mentions come from the client as an explicit list of user ids and are
 * validated server-side against the membership of the place they were posted.
 *
 * The reference build this was ported from matched `@{display name}` against
 * the member list instead. That breaks on two people called Dr Sharma, on
 * anyone whose name contains a space, and the moment somebody renames
 * themselves to match — and it silently notifies the wrong person, which is
 * the worst failure mode available. Ids are unambiguous; the display name in
 * the text is only ever decoration.
 */
export function sanitizeMentions(raw: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((x) => String(x)))].filter((id) => allowed.has(id)).slice(0, 20);
}

// ── Poll / milestone sanitizers ─────────────────────────────

export interface StoredPoll {
  question: string;
  options: string[];
}

/**
 * A poll, or null if what arrived isn't one. Vote COUNTS are not accepted from
 * the client at all — they are counted from social_poll_votes on read, so a
 * crafted payload cannot pre-load a result.
 */
export function sanitizePoll(raw: unknown): StoredPoll | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { question?: unknown; options?: unknown };
  const question = clean(p.question, POLL_QUESTION_MAX);
  const options = Array.isArray(p.options)
    ? p.options
        .map((o) =>
          clean(typeof o === "string" ? o : (o as { text?: unknown })?.text, POLL_OPTION_MAX),
        )
        .filter(Boolean)
        .slice(0, POLL_MAX_OPTIONS)
    : [];
  if (!question || options.length < POLL_MIN_OPTIONS) return null;
  return { question, options };
}

export interface StoredMilestone {
  title: string;
  description: string;
  icon?: string;
}

const MILESTONE_ICONS = new Set(["award", "star", "heart", "sparkles", "trophy", "graduation"]);

export function sanitizeMilestone(raw: unknown): StoredMilestone | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as { title?: unknown; description?: unknown; icon?: unknown };
  const title = clean(m.title, MILESTONE_TITLE_MAX);
  if (!title) return null;
  const icon = typeof m.icon === "string" && MILESTONE_ICONS.has(m.icon) ? m.icon : undefined;
  return { title, description: clean(m.description, MILESTONE_DESC_MAX), icon };
}

// ── Messaging policy ────────────────────────────────────────

/**
 * Conversation sources that skip the mutual-follow gate.
 *
 * An EXPLICIT, server-side allowlist — never a flag the client can set. The
 * gate exists so a stranger cannot open a doctor's inbox; these are the cases
 * where the two people are already in a working relationship and making them
 * follow each other first would be theatre:
 *
 *   consult   — the doctor and the patient in a booked or running visit
 *   gig       — a hired gig, same reasoning
 *   ops       — an operator reaching a provider about their account
 */
export const BYPASS_SOURCES = new Set(["consult", "gig", "ops"]);

// ── Curated communities ─────────────────────────────────────

/**
 * The communities the platform ships with.
 *
 * Seeded if missing and never deleted — but the reconciliation stops there.
 * The build this was ported from also HARD-DELETED every community outside
 * this list, on a plain GET, which is a destructive write on a read path and
 * flatly contradicts letting anyone create one. Here the curated set is a
 * floor: it always exists, it belongs to no one, and everything else people
 * create lives alongside it.
 */
export const CURATED_COMMUNITIES: {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}[] = [
  {
    id: "com-clinical-lounge",
    name: "Clinical Lounge",
    description: "The general room. Introductions, questions, and anything that doesn't fit elsewhere.",
    sortOrder: 10,
  },
  {
    id: "com-case-discussions",
    name: "Case Discussions",
    description: "Anonymised cases, differentials and second reads. No identifying patient detail.",
    sortOrder: 20,
  },
  {
    id: "com-referrals",
    name: "Referrals & Second Opinions",
    description: "Find a colleague in the right specialty, and be found by one.",
    sortOrder: 30,
  },
  {
    id: "com-practice",
    name: "Practice & Earnings",
    description: "Running a practice on the platform, scheduling, gigs, pricing, paperwork.",
    sortOrder: 40,
  },
  {
    id: "com-cme",
    name: "Events & CME",
    description: "Conferences, courses, credit hours and everything worth taking a morning off for.",
    sortOrder: 50,
  },
];

const CURATED_NAMES = new Set(CURATED_COMMUNITIES.map((c) => c.name.toLowerCase()));

/** A curated name can't be claimed by a user-created community. */
export const isCuratedName = (name: string): boolean =>
  CURATED_NAMES.has(name.trim().toLowerCase());

export const isSystemCommunity = (id: string): boolean =>
  CURATED_COMMUNITIES.some((c) => c.id === id);

/** Every community gets these two the first time it is read. */
export const DEFAULT_CHANNELS = [
  { name: "general", type: "text" as const, description: "Everything, unless it has its own room.", sortOrder: 10 },
  { name: "voice-lounge", type: "voice" as const, description: "Drop in and talk.", sortOrder: 20 },
];

// ── Reports ─────────────────────────────────────────────────

export const REPORT_TARGETS = new Set([
  "user",
  "post",
  "comment",
  "message",
  "channel_message",
  "community",
  "story",
]);
