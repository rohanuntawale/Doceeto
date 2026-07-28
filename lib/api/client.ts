"use client";

import { SURFACE_HEADER, surfaceFromPath, type SurfaceRole } from "@/lib/auth/constants";

/**
 * Which app this code is running in, taken from the URL. A browser can hold a
 * patient session and a doctor session at once, so every API call has to say
 * which one it speaks for — otherwise the server picks, and the caller can end
 * up acting as the other account.
 */
export function currentSurface(): SurfaceRole | null {
  if (typeof window === "undefined") return null;
  return surfaceFromPath(window.location.pathname);
}

/** fetch() tagged with the calling surface. Use for every /api request. */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const surface = currentSurface();
  const headers = new Headers(init.headers);
  if (surface) headers.set(SURFACE_HEADER, surface);
  return fetch(input, { ...init, headers });
}
