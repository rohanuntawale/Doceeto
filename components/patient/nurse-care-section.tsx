"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, HeartPulse, ShieldCheck } from "lucide-react";
import { useConsultRequests, useNurses } from "@/lib/hooks/data";
import { formatSlotRange } from "@/lib/scheduling/time";
import { isScheduled } from "@/lib/scheduling/slots";

export function NurseCareSection({ patient }: { patient: { id: string } }) {
  const nurses = useNurses();
  const request = useConsultRequests().find((item) => item.patientId === patient.id && item.targetCadre === "nurse" && (item.status === "pending" || item.status === "accepted"));

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#2F7BC4]/35 bg-[#2F7BC4]/[0.07] p-5 sm:p-6 lg:col-span-12">
      <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#2F7BC4]/15 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F7BC4]/20 text-[#8CC1E8]"><HeartPulse className="h-5 w-5" /></span>
          <div>
            <p className="label text-[#8CC1E8]">HOME CARE</p>
            <h2 className="mt-1 text-xl font-semibold text-cream">Nurse care at home</h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">Book practical support for wound care, elder care, vitals, or injection assistance at a time that suits you.</p>
          </div>
        </div>
        <Link href="/patient/nurses" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#2F7BC4] px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98]">Find a nurse <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
        <Info label="Verified providers" value={String(nurses.length)} />
        <Info label="Booking" value="Choose a time" icon={<CalendarDays className="h-3.5 w-3.5" />} />
        <Info label="Safety" value="Scope-limited care" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
      </div>
      {request && <p className="relative mt-4 rounded-xl border border-[#2F7BC4]/30 bg-black/10 px-3 py-2 text-xs text-[#B7D6F0]">{request.status === "accepted" ? "Your nurse visit is accepted" : "Your nurse request is awaiting confirmation"}{isScheduled(request) && request.scheduledAt ? ` · ${formatSlotRange(request.scheduledAt, request.scheduledEnd)}` : " · as soon as possible"}</p>}
    </section>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#2F7BC4]/20 bg-black/10 px-3 py-3"><p className="text-[11px] text-[var(--text-faint)]">{label}</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-cream">{icon}{value}</p></div>;
}
