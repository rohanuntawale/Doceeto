"use client";

import { MapPin, Clock, Truck, Stethoscope } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { elapsed } from "@/lib/utils/format";
import { sosCategory, sosStatus } from "@/lib/labels";
import { useMounted } from "@/lib/hooks/use-mounted";
import type { Ambulance, Doctor, SosEvent } from "@/lib/types/domain";

export function SosCard({
  event,
  ambulances,
  doctors,
  onAssignAmbulance,
  onAssignDoctor,
  onAdvance,
  compact = false,
}: {
  event: SosEvent;
  ambulances?: Ambulance[];
  doctors?: Doctor[];
  onAssignAmbulance?: (ambulanceId: string) => void;
  onAssignDoctor?: (doctorId: string) => void;
  onAdvance?: () => void;
  compact?: boolean;
}) {
  const mounted = useMounted();
  const cat = sosCategory[event.category];
  const st = sosStatus[event.status];
  const isOpen = event.status === "open";
  const active = event.status !== "resolved" && event.status !== "cancelled";

  const freeAmbulances = (ambulances ?? []).filter((a) => a.status === "free");
  const onlineDoctors = (doctors ?? []).filter((d) => d.status === "online");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border bg-espresso-800 p-4 shadow-card",
        isOpen ? "border-terracotta/50" : "border-[var(--border)]",
      )}
    >
      {isOpen && (
        <span className="absolute left-0 top-0 h-full w-1 animate-pulse bg-terracotta" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid h-11 w-11 place-items-center rounded-lg font-jp text-lg",
              isOpen
                ? "bg-terracotta text-on-accent animate-pulse-ring"
                : "bg-white/5 text-salmon",
            )}
          >
            {cat.kanji}
          </span>
          <div>
            <p className="font-medium text-cream">{event.patientName}</p>
            <p className="text-xs text-[var(--text-muted)]">{cat.label} emergency</p>
          </div>
        </div>
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-[var(--text-muted)]">
        <p className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
          {event.address}
        </p>
        <p className="flex items-center gap-2 font-mono text-xs">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
          {mounted ? elapsed(event.createdAt) : "--:--"} elapsed
          {event.ambulanceId && (
            <span className="ml-2 inline-flex items-center gap-1 text-status-ok">
              <Truck className="h-3.5 w-3.5" /> dispatched
            </span>
          )}
          {event.doctorId && (
            <span className="ml-1 inline-flex items-center gap-1 text-salmon">
              <Stethoscope className="h-3.5 w-3.5" /> doctor
            </span>
          )}
        </p>
      </div>

      {!compact && event.notes && (
        <p className="mt-2 rounded-md bg-black/20 px-3 py-2 text-xs text-[var(--text-muted)]">
          {event.notes}
        </p>
      )}

      {active && (onAssignAmbulance || onAssignDoctor || onAdvance) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onAssignAmbulance && !event.ambulanceId && (
            <AssignMenu
              label="Dispatch ambulance"
              icon={<Truck className="h-3.5 w-3.5" />}
              disabled={freeAmbulances.length === 0}
              options={freeAmbulances.map((a) => ({ id: a.id, label: a.vehicleNo }))}
              onPick={(id) => onAssignAmbulance(id)}
            />
          )}
          {onAssignDoctor && !event.doctorId && (
            <AssignMenu
              label="Assign doctor"
              icon={<Stethoscope className="h-3.5 w-3.5" />}
              disabled={onlineDoctors.length === 0}
              options={onlineDoctors.map((d) => ({ id: d.id, label: d.fullName }))}
              onPick={(id) => onAssignDoctor(id)}
            />
          )}
          {onAdvance && (
            <Button size="sm" variant="subtle" onClick={onAdvance}>
              Advance →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function AssignMenu({
  label,
  icon,
  options,
  onPick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  options: { id: string; label: string }[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        disabled={disabled}
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
        className="peer h-8 cursor-pointer appearance-none rounded-lg border border-[var(--border)] bg-espresso py-0 pl-8 pr-6 text-xs text-cream outline-none hover:border-terracotta/40 focus:border-terracotta/60 disabled:opacity-40"
      >
        <option value="" disabled>
          {disabled ? "None free" : label}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] peer-focus:text-terracotta">
        {icon}
      </span>
    </div>
  );
}
