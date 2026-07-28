import { DoctorShell } from "@/components/doctor/doctor-shell";
import { DoctorLocationPublisher } from "@/components/doctor/location-publisher";
import { DoctorGate } from "@/components/doctor/doctor-gate";
import { LoadingSplash } from "@/components/brand/loading-splash";
import { requireSurface } from "@/lib/auth/guard";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  // Doctor session only — a patient session cannot open the cockpit.
  await requireSurface("doctor");

  return (
    <>
      <LoadingSplash src="/loading/web-load.mp4" />
      <DoctorShell>
        <DoctorLocationPublisher />
        <DoctorGate>{children}</DoctorGate>
      </DoctorShell>
    </>
  );
}
