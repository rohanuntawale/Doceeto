/**
 * The doctor space needs a doctor identity. The middleware guarantees a doctor
 * session, so we just render.
 */
export function DoctorGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
