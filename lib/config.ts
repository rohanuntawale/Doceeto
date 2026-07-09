/**
 * Runtime config. The dashboard works in two modes:
 *  - DEMO   : no Supabase env → seeded data + simulated realtime.
 *  - LIVE   : Supabase env present → real Postgres + Auth + Realtime.
 * UI code never branches on this directly; the hooks in lib/hooks do.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** True when we should run the in-browser demo engine. */
export const isDemoMode = !isSupabaseConfigured;

/**
 * How much data the demo engine starts with.
 *   full     — doctors/ambulances + sample SOS/requests/orders (showcase)
 *   catalog  — doctors/ambulances/stores only, NO activity (test-clean, default)
 *   none     — completely empty
 * Override with NEXT_PUBLIC_SEED. In "catalog" (default) all SOS, consult
 * requests and orders are the ones YOU create via the patient app.
 */
export const SEED_LEVEL = (process.env.NEXT_PUBLIC_SEED ?? "catalog") as
  | "full"
  | "catalog"
  | "none";

/** Map default center — Pune, India (matches seed data). */
export const MAP_CENTER = { lat: 18.5204, lng: 73.8567 };
export const MAP_ZOOM = 12;
