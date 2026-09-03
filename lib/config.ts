/**
 * Runtime config.
 *
 * The client can only read NEXT_PUBLIC_* vars, so the mode flag is public.
 * The store connection details are server-only and never reach the browser.
 *
 * Set NEXT_PUBLIC_BACKEND to "server" (file store) or "neo4j" to go live.
 */

/** True when a real server backend is enabled (any non-empty value). */
export const isLiveMode = Boolean(process.env.NEXT_PUBLIC_BACKEND);

/**
 * Whether to offer "Continue with Google".
 *
 * Keyed on the CLIENT ID, which is public by design — it travels in the URL
 * the browser sends to Google. The secret stays server-side in
 * GOOGLE_CLIENT_SECRET and is never referenced from a client component.
 */
export const googleAuthEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

/** Map fallback center - Nagpur, India (used until real geolocation arrives). */
export const MAP_CENTER = { lat: 21.1458, lng: 79.0882 };
export const MAP_ZOOM = 12;

/** Transparent commission on each completed visit (the doctor keeps the rest). */
export const COMMISSION_RATE = 0.15;

/**
 * Medicine ordering, hidden from patients for now — flip to true to bring the
 * tab, chips and order rows back. The store page, APIs and ops fulfilment
 * views stay intact underneath; this only gates what PATIENTS can see.
 */
export const MEDICINE_ENABLED = false;
