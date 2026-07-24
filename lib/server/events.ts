import "server-only";

/**
 * In-process change bus feeding the SSE stream (/api/stream).
 * Every successful write emits which entities changed; connected clients
 * invalidate those query keys instantly instead of waiting for the poll.
 *
 * NOTE: this is per-Node-process. On a single long-running server
 * (Render, `npm start`, dev) it is fully live. On serverless (Vercel)
 * an emit in one lambda can't reach a stream held by another — clients
 * fall back to polling there, which the frontend already handles.
 */

export interface ChangeEvent {
  entities: string[];
  at: number;
}

type Listener = (evt: ChangeEvent) => void;

// Survive dev hot-reload by stashing the listener set on globalThis.
const g = globalThis as unknown as { __iyashiBus?: Set<Listener> };
const listeners: Set<Listener> = (g.__iyashiBus ??= new Set());

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitChange(entities: string[]) {
  const evt: ChangeEvent = { entities, at: Date.now() };
  for (const fn of listeners) {
    try {
      fn(evt);
    } catch {
      /* a dead stream must not break the others */
    }
  }
}
