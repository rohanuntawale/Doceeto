"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { DAnswer, DConclusion } from "@/lib/diagnose/engine";

/**
 * The patient's own health record on this device: every symptom-checker
 * session (what they reported + what it concluded). It powers the chat
 * sidebar (past checks + reports) AND feeds priors back into the engine so
 * options stay in sync with history. Demo -> localStorage; a real build
 * would sync this to the account.
 */
export interface CheckSession {
  id: string;
  startedAt: number;
  title: string;
  seed: string;
  answers: DAnswer[];
  conclusion: DConclusion | null;
}

const KEY = "iyashi:medhistory:v1";

let sessions: CheckSession[] = [];
let hydrated = false;
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
      sessions = JSON.parse(raw);
      emit();
    }
  } catch {
    /* ignore */
  }
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
  const idx = sessions.findIndex((x) => x.id === s.id);
  if (idx >= 0) sessions[idx] = s;
  else sessions = [s, ...sessions];
  persist();
  emit();
  return s.id;
}

export function deleteSession(id: string) {
  sessions = sessions.filter((s) => s.id !== id);
  persist();
  emit();
}

export function clearHistory() {
  sessions = [];
  persist();
  emit();
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

export function useMedicalHistory() {
  const list = useSyncExternalStore(
    subscribe,
    () => sessions,
    () => [] as CheckSession[],
  );
  const save = useCallback((s: CheckSession) => saveSession(s), []);
  return {
    sessions: list,
    saveSession: save,
    deleteSession,
    clearHistory,
    recentConditions,
  };
}
