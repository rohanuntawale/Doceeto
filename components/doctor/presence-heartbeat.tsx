"use client";

import { useEffect } from "react";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { useActions } from "@/lib/hooks/data";
import { isDemoMode } from "@/lib/config";
import { HEARTBEAT_MS } from "@/lib/presence";

/**
 * "I'm still here." Mounted once in the doctor layout; renders nothing.
 *
 * Being online is a claim about RIGHT NOW, and the ways of ceasing to be online
 * are mostly silent: the laptop lid closes, the battery dies, the train enters a
 * tunnel, the tab is killed. None of those send a goodbye, so absence can only
 * be noticed by the arrival of nothing. This posts a beat on an interval and the
 * read path stops believing a doctor whose last beat has aged out
 * (lib/presence.ts).
 *
 * It beats regardless of the online/offline toggle: the toggle is the doctor's
 * intent, this is the evidence, and a doctor who is present but paused should
 * still be seen as present the moment they flip back.
 */
export function PresenceHeartbeat() {
  const me = useCurrentDoctor();
  const { heartbeat } = useActions();
  const doctorId = me?.id;

  useEffect(() => {
    if (isDemoMode || !doctorId) return;

    let stopped = false;
    const beat = () => {
      if (stopped) return;
      // Fire-and-forget: a missed beat is survivable (the window allows three),
      // and a failed one must never surface as an error in the cockpit.
      void heartbeat().catch(() => {});
    };

    beat(); // straight away, so a fresh sign-in is visible immediately
    const timer = setInterval(beat, HEARTBEAT_MS);

    // Coming back to the tab should not wait out the interval — the doctor may
    // be looking at the screen expecting to be findable.
    const onWake = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", beat);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", beat);
    };
  }, [doctorId, heartbeat]);

  return null;
}
