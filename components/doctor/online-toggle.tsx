"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { isDemoMode } from "@/lib/config";
import { useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import type { Doctor } from "@/lib/types/domain";

export function OnlineToggle({
  doctor,
  variant = "card",
}: {
  doctor?: Doctor;
  /**
   * "card"   — standalone panel with its own status text (profile page).
   * "inline" — just the switch, for a card that already states the status.
   *            Nesting the full panel inside one was overflowing its parent
   *            and repeating the same sentence twice.
   */
  variant?: "card" | "inline";
}) {
  const { setDoctorStatus } = useActions();
  const toast = useToast();
  const router = useRouter();
  const online = doctor?.status === "online";

  async function toggle() {
    if (!doctor) return;
    const next = online ? "offline" : "online";

    // No photo, no roster (live mode; the server enforces it regardless).
    // Caught here so the doctor lands on the fix, not just an error.
    if (next === "online" && !isDemoMode && !doctor.avatarUrl) {
      toast.push({
        tone: "error",
        title: "Add a profile photo first",
        desc: "Patients need to see who's treating them. Add one on your profile page.",
      });
      router.push("/doctor/profile");
      return;
    }

    try {
      await setDoctorStatus(doctor.id, next);
      toast.push({
        tone: next === "online" ? "success" : "info",
        title: next === "online" ? "You're online" : "You're offline",
        desc:
          next === "online"
            ? "Consult requests from nearby patients will reach you."
            : "You won't receive new requests.",
      });
    } catch (err) {
      // The server owns the rules — show exactly what it said.
      toast.push({
        tone: "error",
        title: next === "online" ? "Couldn't go online" : "Couldn't go offline",
        desc: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  const swtch = (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={online}
      aria-label={online ? "Go offline" : "Go online"}
      className={cn(
        "flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]",
        online ? "bg-terracotta" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-on-accent shadow transition-transform duration-200",
          online ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );

  if (variant === "inline") return swtch;

  return (
    <div className="flex items-center gap-3.5 rounded-card border border-[var(--border)] bg-espresso-800 px-4 py-3 shadow-card">
      {swtch}
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              online ? "bg-status-ok animate-pulse" : "bg-[var(--text-faint)]",
            )}
          />
          <p className="truncate text-sm font-medium text-cream">
            {online ? "Online and taking patients" : "Offline"}
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
          {online
            ? "Tap to go offline"
            : "Go online to receive consults"}
        </p>
      </div>
    </div>
  );
}
