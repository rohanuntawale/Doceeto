"use client";

/**
 * DEMO-ONLY self-driving simulator. So a solo visitor actually SEES the
 * Uber loop without a second tab: it auto-accepts a pending request with a
 * nearby verified doctor, then advances on-my-way → arrived → completed
 * (with a sample prescription). It only ever touches requests still in the
 * expected state, so a real manual accept in the doctor tab wins the race.
 *
 * Never runs in live mode.
 */
import { demoStore } from "@/lib/demo/store";
import { haversineKm } from "@/lib/utils/geo";

/** How long (ms) a home/clinic visit takes to "arrive" in the demo. */
export const DEMO_TRIP_MS = 12_000;
const ACCEPT_AFTER_MS = 3_500; // give a real doctor a moment to grab it first
const VIDEO_DONE_MS = 8_000;

let started = false;

const ageMs = (iso: string | null | undefined) =>
  iso ? Date.now() - new Date(iso).getTime() : 0;

function tick() {
  const s = demoStore.get();
  for (const r of s.requests) {
    if (r.status === "pending") {
      if (ageMs(r.createdAt) < ACCEPT_AFTER_MS) continue;
      const verified = s.doctors.filter((d) => d.verificationStatus === "verified");
      if (verified.length === 0) continue;
      const doc = r.doctorId
        ? verified.find((d) => d.id === r.doctorId)
        : [...verified].sort((a, b) => haversineKm(a, r) - haversineKm(b, r))[0];
      if (doc) demoStore.acceptRequest(r.id, doc.id);
    } else if (r.status === "accepted") {
      const age = ageMs(r.acceptedAt);
      if (r.type === "video") {
        if (age > VIDEO_DONE_MS) issueDemoRx(r.id, r.doctorId);
      } else if (age > 2_000) {
        demoStore.startVisit(r.id);
      }
    } else if (r.status === "enroute") {
      if (ageMs(r.acceptedAt) > DEMO_TRIP_MS) demoStore.arriveVisit(r.id);
    } else if (r.status === "arrived") {
      // brief pause "with the patient", then wrap up with a prescription.
      const arrivedFor = ageMs(r.acceptedAt) - DEMO_TRIP_MS;
      if (arrivedFor > 4_000) issueDemoRx(r.id, r.doctorId);
    }
  }
}

function issueDemoRx(requestId: string, doctorId: string | null) {
  if (!doctorId) return;
  demoStore.createPrescription({
    requestId,
    doctorId,
    diagnosis: "Viral fever",
    items: [
      { name: "Paracetamol 650mg", dosage: "1-0-1", duration: "3 days" },
      { name: "ORS", dosage: "as needed", duration: "3 days" },
    ],
    advice: "Rest and fluids. Follow up if fever persists beyond 3 days.",
  });
}

export function startDemoSimulator() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.setInterval(tick, 2_000);
}
