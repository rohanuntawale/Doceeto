"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { surfaceFromPath } from "@/lib/auth/constants";
import { setSseConnected } from "@/lib/hooks/data";

/**
 * Live mode only: connects to /api/stream (SSE) and invalidates the matching
 * query keys the moment the server reports a change — so the UI updates
 * instantly instead of waiting for the poll. If the stream can't connect
 * (serverless, proxy, offline) polling stays at full speed and nothing
 * breaks. Renders nothing.
 *
 * ── Only on a SIGNED-IN SURFACE ──
 *
 * This component is mounted in the root providers, so it runs on every page in
 * the app — including the landing page, /login, /support and the /try previews,
 * none of which has a session. /api/stream requires one and answers 401, which
 * used to start a retry loop that could never succeed: a signed-out visitor
 * reading the landing page generated an unauthorized request every ten seconds
 * for as long as the tab stayed open.
 *
 * So the surface is now the PRECONDITION, not a query parameter added at the
 * end. No surface, no connection — there is nothing to stream to someone who
 * isn't signed in.
 *
 * ── Why the pathname is a dependency ──
 *
 * The surface used to be read once from `window.location` when the effect
 * first ran. App-router navigations don't re-run an effect with a `[qc]`
 * dependency, so signing in and moving to /patient left the bridge holding
 * whatever it had decided on the landing page — and leaving a surface left the
 * old connection open. Keying on `pathname` means crossing a surface boundary
 * tears down the old stream and opens the right one.
 */

/**
 * One live connection per tab, tracked outside React.
 *
 * In development React mounts effects twice, which opened two EventSources and
 * — worse — let the first one's cleanup set the shared "SSE is connected" flag
 * to false while the second was still streaming. The read hooks use that flag
 * to decide their poll interval, so the app quietly fell back to polling while
 * believing it was live.
 */
let connections = 0;

/** First retry delay; doubles up to RETRY_MAX_MS. */
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;
/**
 * Give up after this many consecutive failures.
 *
 * A stream that has failed six times in a row is not going to be fixed by a
 * seventh attempt — it is a proxy stripping the connection, a serverless
 * deployment where SSE cannot work at all, or a session that ended. Polling
 * already covers every one of those cases, so the honest move is to stop
 * asking. A fresh navigation re-runs the effect and resets the count.
 */
const RETRY_LIMIT = 6;

export function RealtimeBridge() {
  const qc = useQueryClient();
  const pathname = usePathname();

  useEffect(() => {
    if (isDemoMode || typeof window === "undefined" || !("EventSource" in window)) {
      return;
    }

    // THE GATE. `/`, `/try/*`, `/support`, `/login`, `/about` and every other
    // public page resolve to null — those visitors are not signed in, so there
    // is no session for the stream to authorize and no point asking.
    const surface = surfaceFromPath(pathname);
    if (!surface) {
      setSseConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let failures = 0;
    connections += 1;

    const connect = () => {
      if (stopped) return;
      // EventSource cannot set headers, so the surface rides in the query
      // string — without it the stream could authorize as the other role
      // signed in on this browser.
      es = new EventSource(`/api/stream?surface=${surface}`);

      es.onopen = () => {
        failures = 0; // a good connection clears the backoff
        setSseConnected(true);
      };

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { entities?: string[] };
          (msg.entities ?? []).forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        } catch {
          /* ignore malformed frames */
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        // The browser reconnects transient drops by itself. CLOSED means it
        // gave up — an HTTP error (401, 404, a proxy 502) or a hard failure.
        if (es?.readyState !== EventSource.CLOSED) return;
        es.close();

        failures += 1;
        if (failures >= RETRY_LIMIT) return; // polling takes it from here

        // Exponential backoff. The old fixed 10s meant a permanently failing
        // stream produced six requests a minute, forever.
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures - 1));
        retry = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      connections -= 1;
      // Only the LAST bridge to unmount may declare the app offline. Without
      // this the dev double-mount immediately marked it disconnected.
      if (connections <= 0) setSseConnected(false);
      es?.close();
      if (retry) clearTimeout(retry);
    };
  }, [qc, pathname]);

  return null;
}
