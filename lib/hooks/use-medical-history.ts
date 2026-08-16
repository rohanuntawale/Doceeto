"use client";

import { useCallback, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api/client";
import {
  mergeSessions,
  sanitizeSession,
  upsertSession,
  type CheckSession,
} from "@/lib/care/history";

export type { CheckSession };

/**
 * The patient's health record: every symptom-checker session (what they
 * reported + what it concluded). It powers the chat sidebar (past checks +
 * reports) AND feeds priors back into the engine so options stay in sync
 * with history.
 *
 * Storage is two-tier, like any chat app:
 *   • the account (via /api/care/history) is the source of truth — history
 *     survives refreshes, cleared browsers, and other devices;
 *   • localStorage is a device cache so the sidebar paints instantly and
 *     signed-out visitors still keep their checks on this device.
 * On hydrate the two are merged (per session, the further-progressed copy
 * wins) and anything the server was missing is pushed back up.
 */

const KEY = "iyashi:medhistory:v1";
/** Which account the cached copy belongs to. If another patient signs in on
 *  this device, their history must not inherit the previous person's chats. */
const OWNER_KEY = "iyashi:medhistory:owner";

let sessions: CheckSession[] = [];
let hydrated = false;
let serverSynced = false;
let listeners: Array<() => void> = [];

const emit = () => listeners.forEach((l) => l());

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sessions));
  } catch {
    /* ignore */
  }
}

function hydrateOnce() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      sessions = (JSON.parse(raw) as unknown[])
        .map(sanitizeSession)
        .filter(Boolean) as CheckSession[];
      emit();
    }
  } catch {
    /* ignore */
  }
  void syncFromServer();
}

/** Pull the account's history and reconcile it with the device cache. */
async function syncFromServer() {
  if (serverSynced) return;
  serverSynced = true;
  try {
    const res = await apiFetch("/api/care/history");
    if (!res.ok) return;
    const data = (await res.json()) as {
      sessions: unknown[] | null;
      patientId?: string;
    };
    // Signed out → stay device-local.
    if (!Array.isArray(data.sessions) || !data.patientId) return;

    const server = data.sessions
      .map(sanitizeSession)
      .filter(Boolean) as CheckSession[];

    const owner = window.localStorage.getItem(OWNER_KEY);
    if (owner !== data.patientId) {
      /*
       * The cache does not demonstrably belong to this account, so it is not
       * adopted. It is either someone else's record, or of unknown provenance.
       *
       * The unknown case is the one that used to bite: with no owner stamped
       * yet, the old `owner && owner !== id` test fell through to the merge
       * branch, so a freshly registered account inherited whatever checks were
       * already sitting in this browser AND uploaded them to the server as its
       * own. That is why a brand-new account opened on a used browser greeted
       * its owner with someone else's symptom checks.
       *
       * Signed-out checks are therefore not carried into a new account. If we
       * want that, it has to be an explicit "import these?" prompt, never a
       * silent merge into a medical record.
       */
      sessions = server;
    } else {
      sessions = mergeSessions(server, sessions);
      // Anything the device had that the server lacked (offline use, or
      // history from before server storage existed) goes up in one batch.
      const serverIds = new Map(server.map((s) => [s.id, s.answers.length]));
      const missing = sessions.filter(
        (s) => (serverIds.get(s.id) ?? -1) < s.answers.length || !serverIds.has(s.id),
      );
      if (missing.length > 0) {
        apiFetch("/api/care/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessions: missing }),
        }).catch(() => {});
      }
    }
    window.localStorage.setItem(OWNER_KEY, data.patientId);
    persist();
    emit();
  } catch {
    /* offline — the cache carries the session; SiteDownGate tells the story */
  }
}

// One debounce timer per session id: saveSession fires on every answered
// question, but the server only needs the settled state of a turn.
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function pushToServer(s: CheckSession) {
  clearTimeout(pushTimers.get(s.id));
  pushTimers.set(
    s.id,
    setTimeout(() => {
      pushTimers.delete(s.id);
      apiFetch("/api/care/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: s }),
      }).catch(() => {});
    }, 800),
  );
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  hydrateOnce();
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/** Save (or update) a session; newest first. Returns the id. */
export function saveSession(s: CheckSession) {
  sessions = upsertSession(sessions, s);
  persist();
  emit();
  pushToServer(s);
  return s.id;
}

export function deleteSession(id: string) {
  sessions = sessions.filter((s) => s.id !== id);
  persist();
  emit();
  apiFetch(`/api/care/history?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).catch(() => {});
}

export function clearHistory() {
  sessions = [];
  persist();
  emit();
  apiFetch("/api/care/history", { method: "DELETE" }).catch(() => {});
}

/** Conditions from recent concluded sessions — priors for the next check. */
export function recentConditions(limit = 5): string[] {
  const out: string[] = [];
  for (const s of sessions) {
    for (const c of s.conclusion?.conditions ?? []) {
      if (!out.includes(c)) out.push(c);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * The server snapshot MUST be referentially stable. Returning a fresh `[]` on
 * every call makes React see a changed store on each render, which it reports
 * as "getServerSnapshot should be cached to avoid an infinite loop".
 */
const NO_SESSIONS: CheckSession[] = [];

export function useMedicalHistory() {
  const list = useSyncExternalStore(subscribe, () => sessions, () => NO_SESSIONS);
  const save = useCallback((s: CheckSession) => saveSession(s), []);
  return {
    sessions: list,
    saveSession: save,
    deleteSession,
    clearHistory,
    recentConditions,
  };
}
