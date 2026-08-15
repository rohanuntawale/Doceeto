import { NurseShell } from "@/components/nurse/nurse-shell";
import { DoctorLocationPublisher } from "@/components/doctor/location-publisher";
import { PresenceHeartbeat } from "@/components/doctor/presence-heartbeat";
import { StartVisitPin } from "@/components/consult/start-visit-pin";
import { LoadingSplash } from "@/components/brand/loading-splash";
import { requireSurface } from "@/lib/auth/guard";

/**
 * Nurse session only — a patient or doctor session cannot open this console.
 *
 * The location publisher and the heartbeat are the doctor cockpit's, reused
 * rather than copied: both read "me" through useCurrentProvider and write
 * through provider-wide actions, so they work for either cadre. Without them a
 * nurse has no live position and never counts as online, which is exactly what
 * left the map empty.
 */
export default async function NurseLayout({ children }: { children: React.ReactNode }) {
  await requireSurface("nurse");

  return (
    <>
      <LoadingSplash src="/loading/doceeto-landing.mp4" />
      <NurseShell>
        <DoctorLocationPublisher />
        <PresenceHeartbeat />
        {children}
        {/* Same pinned handshake as the doctor cockpit — a nurse standing at a
            door needs it in exactly the same place. */}
        <StartVisitPin />
      </NurseShell>
    </>
  );
}
