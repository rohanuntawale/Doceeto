import { DoctorShell } from "@/components/doctor/doctor-shell";
import { DoctorLocationPublisher } from "@/components/doctor/location-publisher";
import { DoctorGate } from "@/components/doctor/doctor-gate";
import { LoadingSplash } from "@/components/brand/loading-splash";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
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
