import { PatientShell } from "@/components/patient/patient-shell";
import { PatientLocationSync } from "@/components/patient/location-sync";
import { ArrivalWatcher } from "@/components/patient/arrival-watcher";
import { LoadingSplash } from "@/components/brand/loading-splash";
import { requireSurface } from "@/lib/auth/guard";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Patient session only — a doctor session cannot open the patient app.
  await requireSurface("patient");

  return (
    <>
      <LoadingSplash src="/loading/web-load.mp4" />
      <PatientShell>
        <PatientLocationSync />
        <ArrivalWatcher />
        {children}
      </PatientShell>
    </>
  );
}
