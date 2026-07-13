/**
 * Runtime config. The app works in two modes:
 *  - DEMO : no backend env -> seeded in-browser store, zero setup.
 *  - LIVE : Neo4j backend -> real auth + graph data via /api routes.
 *
 * The client can only read NEXT_PUBLIC_* vars, so the mode flag is public.
 * The Neo4j connection itself (NEO4J_URI/USER/PASSWORD) is server-only and
 * never reaches the browser.
 */

/** True when the Neo4j-backed live mode is enabled. */
export const isLiveMode = process.env.NEXT_PUBLIC_BACKEND === "neo4j";

/** True when we should run the in-browser demo engine (default). */
export const isDemoMode = !isLiveMode;

/**
 * How much data the demo engine starts with.
 *   full     - doctors/ambulances + sample SOS/requests/orders (showcase)
 *   catalog  - doctors/ambulances/stores only, NO activity (test-clean, default)
 *   none     - completely empty
 */
export const SEED_LEVEL = (process.env.NEXT_PUBLIC_SEED ?? "catalog") as
  | "full"
  | "catalog"
  | "none";

/** Map default center - Pune, India (matches seed data). */
export const MAP_CENTER = { lat: 18.5204, lng: 73.8567 };
export const MAP_ZOOM = 12;
