/**
 * Runtime config. The app works in two modes:
 *  - DEMO : no backend env -> in-browser store (per-browser), zero setup.
 *  - LIVE : a real server backend via the /api routes. The server picks
 *           its store automatically: Neo4j when NEO4J_URI is set, else a
 *           zero-setup file store. Either way the client is identical.
 *
 * The client can only read NEXT_PUBLIC_* vars, so the mode flag is public.
 * The store connection details are server-only and never reach the browser.
 *
 * Set NEXT_PUBLIC_BACKEND to "server" (file store) or "neo4j" to go live.
 */

/** True when a real server backend is enabled (any non-empty value). */
export const isLiveMode = Boolean(process.env.NEXT_PUBLIC_BACKEND);

/** True when we should run the in-browser demo engine (default). */
export const isDemoMode = !isLiveMode;

/**
 * There is NO seeded demo data. Every doctor, patient, SOS, request and
 * order in the app is created through the product itself (register,
 * book, SOS) — in demo mode into the in-browser store, in live mode
 * into Neo4j.
 */

/** Map fallback center - Nagpur, India (used until real geolocation arrives). */
export const MAP_CENTER = { lat: 21.1458, lng: 79.0882 };
export const MAP_ZOOM = 12;

/** Transparent commission on each completed visit (the doctor keeps the rest). */
export const COMMISSION_RATE = 0.15;
