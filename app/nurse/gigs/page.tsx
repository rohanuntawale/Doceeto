/**
 * The nurse's gig shelf — the same cockpit page doctors use, rendered inside
 * the nurse console. The page component is provider-generic end to end:
 * useCurrentDoctor resolves the signed-in provider on whichever surface asks,
 * useGigs() returns the session provider's own shelf, and every write goes
 * through the cadre-blind gig actions. Gigs are the PRIMARY way patients hire
 * a nurse (appointments are the fallback), exactly as they are for doctors.
 */
export { default } from "@/app/doctor/gigs/page";
