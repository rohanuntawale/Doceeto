import { PatientShell } from "@/components/patient/patient-shell";
import { PatientLocationSync } from "@/components/patient/location-sync";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PatientShell>
      <PatientLocationSync />
      {children}
    </PatientShell>
  );
}
