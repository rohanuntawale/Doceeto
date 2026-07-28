"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { currentSurface } from "@/lib/api/client";
import { setSseConnected } from "@/lib/hooks/data";

/**
 * Live mode only: connects to /api/stream (SSE) and invalidates the
 * matching query keys the moment the server reports a change — so the
 * UI updates instantly instead of waiting for the poll. If the stream
 * can't connect (serverless, proxy, offline) polling stays at full
 * speed and nothing breaks. Renders nothing.
 */
export function RealtimeBridge() {
  const qc = useQueryClient();

  useEffect(() => {
    if (isDemoMode || typeof window === "undefined" || !("EventSource" in window)) {
      return;
    }

    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      // EventSource cannot set headers, so the surface rides in the query
      // string — without it the stream could authorize as the other role
      // signed in on this browser.
      const surface = currentSurface();
      es = new EventSource(surface ? `/api/stream?surface=${surface}` : "/api/stream");
      es.onopen = () => setSseConnected(true);
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { entities?: string[] };
          (msg.entities ?? []).forEach((k) =>
            qc.invalidateQueries({ queryKey: [k] }),
          );
        } catch {
          /* ignore malformed frames */
        }
      };
      es.onerror = () => {
        // Browser auto-reconnects for transient errors, but if the
        // stream is closed (401, proxy kill) fall back to fast polling
        // and retry with backoff.
        setSseConnected(false);
        if (es?.readyState === EventSource.CLOSED) {
          es.close();
          retry = setTimeout(connect, 10_000);
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      setSseConnected(false);
      es?.close();
      if (retry) clearTimeout(retry);
    };
  }, [qc]);

  return null;
}
