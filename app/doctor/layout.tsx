import { DoctorShell } from "@/components/doctor/doctor-shell";
import { DoctorLocationPublisher } from "@/components/doctor/location-publisher";
import { PresenceHeartbeat } from "@/components/doctor/presence-heartbeat";
import { DoctorGate } from "@/components/doctor/doctor-gate";
import { StartVisitPin } from "@/components/consult/start-visit-pin";
import { LoadingSplash } from "@/components/brand/loading-splash";
import { requireSurface } from "@/lib/auth/guard";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  // Doctor session only — a patient session cannot open the cockpit.
  await requireSurface("doctor");

  return (
    <>
      <LoadingSplash src="/loading/doceeto-landing.mp4" />
      <DoctorShell>
        <DoctorLocationPublisher />
        <PresenceHeartbeat />
        <DoctorGate>{children}</DoctorGate>
        {/* Pinned in the layout: the code is entered on a doorstep, so it must
            not depend on which screen the doctor happens to be looking at. */}
        <StartVisitPin />
      </DoctorShell>
    </>
  );
}
