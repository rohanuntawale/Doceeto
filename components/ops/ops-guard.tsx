"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isDemoMode } from "@/lib/config";
import { readOpsAuthed } from "@/lib/ops-auth";

/**
 * Client gate for the ops console. Live mode is guarded server-side by
 * middleware; demo mode checks the local passcode flag and bounces to
 * the ops sign-in if it's missing.
 */
export function OpsGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(!isDemoMode);

  useEffect(() => {
    if (!isDemoMode) return;
    if (readOpsAuthed()) setAllowed(true);
    else router.replace("/ops-signin");
  }, [router]);

  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="text-sm text-[var(--text-faint)] animate-pulse">
          Loading…
        </span>
      </div>
    );
  }
  return <>{children}</>;
}
