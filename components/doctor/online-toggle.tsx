"use client";

import { cn } from "@/lib/utils/cn";
import { useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import type { Doctor } from "@/lib/types/domain";

export function OnlineToggle({ doctor }: { doctor?: Doctor }) {
  const { setDoctorStatus } = useActions();
  const toast = useToast();
  const online = doctor?.status === "online";

  function toggle() {
    if (!doctor) return;
    const next = online ? "offline" : "online";
    setDoctorStatus(doctor.id, next);
    toast.push({
      tone: next === "online" ? "success" : "info",
      title: next === "online" ? "You're online" : "You're offline",
      desc:
        next === "online"
          ? "Requests and nearby SOS alerts will reach you."
          : "You won't receive new requests.",
    });
  }

  return (
    <div className="flex items-center gap-3.5 rounded-card border border-[var(--border)] bg-espresso-800 px-4 py-3 shadow-card">
      <button
        onClick={toggle}
        role="switch"
        aria-checked={online}
        aria-label={online ? "Go offline" : "Go online"}
        className={cn(
          "flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors",
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
            : "Go online to receive consults & SOS"}
        </p>
      </div>
    </div>
  );
}
