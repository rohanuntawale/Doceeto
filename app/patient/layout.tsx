import { PatientShell } from "@/components/patient/patient-shell";
import { PatientLocationSync } from "@/components/patient/location-sync";
import { LoadingSplash } from "@/components/brand/loading-splash";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LoadingSplash src="/loading/web-load.mp4" />
      <PatientShell>
        <PatientLocationSync />
        {children}
      </PatientShell>
    </>
  );
}
