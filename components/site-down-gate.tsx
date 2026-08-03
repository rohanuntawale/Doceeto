"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteDown } from "@/components/ui/site-down-page";

const HEALTH_URL = "/api/health";
const PROBE_TIMEOUT_MS = 4_000;
const HEALTHY_INTERVAL_MS = 30_000;
const DOWN_INTERVAL_MS = 5_000;
// Two consecutive failures before tripping, so a single slow response or
// one dropped request doesn't flash the down page over a working app.
const FAILURES_TO_TRIP = 2;

/**
 * Watches server reachability and overlays the SiteDown page only while the
 * backend is actually unreachable (server stopped, localhost killed, or the
 * device offline). Renders nothing at all during normal operation, and
 * removes the overlay automatically once the server answers again.
 *
 * Note: this can only cover outages that happen after the app has loaded —
 * if the server is already dead on first visit, the browser never receives
 * any page to render.
 */
export function SiteDownGate() {
  const [down, setDown] = useState(false);
  const [checking, setChecking] = useState(false);
  const failures = useRef(0);
  const downRef = useRef(false);
  downRef.current = down;

  const probe = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(HEALTH_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`health ${res.status}`);
      failures.current = 0;
      setDown(false);
    } catch {
      failures.current += 1;
      if (failures.current >= FAILURES_TO_TRIP || downRef.current) {
        setDown(true);
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const loop = async () => {
      await probe();
      if (cancelled) return;
      timer = setTimeout(loop, downRef.current ? DOWN_INTERVAL_MS : HEALTHY_INTERVAL_MS);
    };

    // The offline event is definitive — no network means no server.
    const onOffline = () => {
      failures.current = FAILURES_TO_TRIP;
      setDown(true);
    };
    const onOnline = () => void probe();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    // First probe waits one healthy interval: page load itself just proved
    // the server was up, so there's nothing to learn by asking immediately.
    timer = setTimeout(loop, HEALTHY_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [probe]);

  if (!down) return null;

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto bg-canvas">
      <SiteDown onRetry={probe} checking={checking} />
    </div>
  );
}
