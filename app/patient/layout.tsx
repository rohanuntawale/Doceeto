import { PatientShell } from "@/components/patient/patient-shell";
import { PatientLocationSync } from "@/components/patient/location-sync";
import { ArrivalWatcher } from "@/components/patient/arrival-watcher";
import { ArrivalCodePin } from "@/components/patient/arrival-code-pin";
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
      <LoadingSplash src="/loading/doceeto-landing.mp4" />
      <PatientShell>
        <PatientLocationSync />
        <ArrivalWatcher />
        {children}
        {/* Pinned in the layout, not on a page: the code has to survive
            navigating around the app while someone is on their way. */}
        <ArrivalCodePin />
      </PatientShell>
    </>
  );
}
