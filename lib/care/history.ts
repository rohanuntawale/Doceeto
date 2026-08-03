import type { DAnswer, DConclusion } from "@/lib/diagnose/engine";

/**
 * One symptom-checker chat: what the patient reported, every Q&A turn, and
 * the conclusion (if reached). This is the unit the whole history feature
 * moves around — the care page saves it turn by turn, the sidebar lists it,
 * and /api/care/history persists it on the patient's account so it survives
 * refreshes and follows them across devices, like any chat app's history.
 */
export interface CheckSession {
  id: string;
  startedAt: number;
  title: string;
  seed: string;
  answers: DAnswer[];
  conclusion: DConclusion | null;
}

/** Most sessions kept per patient — newest win. */
export const MAX_SESSIONS = 50;
const MAX_ANSWERS = 80;
/** Per-session ceiling once serialized. A JSONB blob per patient stays small
 *  (50 × 20KB worst case), and anything bigger than this is malformed input,
 *  not a real chat. */
const MAX_SESSION_JSON = 20_000;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

/**
 * Coerce an untrusted session (request body or old localStorage) into a
 * well-formed CheckSession, or null if it's unusable. The conclusion is kept
 * structurally intact (the UI knows its shape) but size-capped with the rest.
 */
export function sanitizeSession(raw: unknown): CheckSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 64);
  if (!id) return null;

  const startedAt = Number(r.startedAt);
  const answers: DAnswer[] = (Array.isArray(r.answers) ? r.answers : [])
    .slice(0, MAX_ANSWERS)
    .flatMap((a) => {
      if (!a || typeof a !== "object") return [];
      const x = a as Record<string, unknown>;
      const label = str(x.label, 500);
      if (!label) return [];
      return [
        {
          questionId: str(x.questionId, 64) || "free",
          prompt: str(x.prompt, 500),
          value: str(x.value, 500) || label,
          label,
        },
      ];
    });

  const session: CheckSession = {
    id,
    startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now(),
    title: str(r.title, 80) || "Symptom check",
    seed: str(r.seed, 500),
    answers,
    conclusion:
      r.conclusion && typeof r.conclusion === "object"
        ? (r.conclusion as DConclusion)
        : null,
  };

  try {
    if (JSON.stringify(session).length > MAX_SESSION_JSON) {
      // Oversize almost always means a bloated conclusion payload; dropping it
      // keeps the transcript rather than losing the whole session.
      session.conclusion = null;
      if (JSON.stringify(session).length > MAX_SESSION_JSON) return null;
    }
  } catch {
    return null;
  }
  return session;
}

/** Upsert into a newest-first list, capped at MAX_SESSIONS. */
export function upsertSession(
  list: CheckSession[],
  s: CheckSession,
): CheckSession[] {
  const rest = list.filter((x) => x.id !== s.id);
  return [s, ...rest]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_SESSIONS);
}

/**
 * Merge the server's copy with what this device has. Same id → keep whichever
 * copy progressed further (more turns, else a conclusion, else the server's).
 * Used on hydrate, where either side can be behind: the server after offline
 * use, the device after chatting from another phone.
 */
export function mergeSessions(
  server: CheckSession[],
  local: CheckSession[],
): CheckSession[] {
  const byId = new Map(server.map((s) => [s.id, s]));
  for (const l of local) {
    const s = byId.get(l.id);
    if (!s) byId.set(l.id, l);
    else if (
      l.answers.length > s.answers.length ||
      (l.answers.length === s.answers.length && l.conclusion && !s.conclusion)
    )
      byId.set(l.id, l);
  }
  return [...byId.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_SESSIONS);
}
