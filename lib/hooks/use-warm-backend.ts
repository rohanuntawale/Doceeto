"use client";

import { useEffect } from "react";
import { isDemoMode } from "@/lib/config";

/**
 * Fire-and-forget database wake-up for pages that lead into sign-in.
 *
 * The free Neon tier suspends after a few idle minutes; the first sign-in then
 * pays a multi-second resume inside the OAuth callback, which reads as "the
 * Google button is broken". Pinging from the page instead moves that wait to
 * while the person is still typing / picking a Google account.
 */
export function useWarmBackend() {
  useEffect(() => {
    if (isDemoMode) return;
    fetch("/api/warm").catch(() => {
      /* best-effort */
    });
  }, []);
}
