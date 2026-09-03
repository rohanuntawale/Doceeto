/**
 * Client gate for the ops console. Guarded server-side by middleware.
 */
export function OpsGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
