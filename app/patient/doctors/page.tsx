"use client";

import { useState } from "react";
import { Star, BadgeCheck, Video, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useDoctors, useActions } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { doctorStatus } from "@/lib/labels";
import { formatINR, initials } from "@/lib/utils/format";
import { haversineKm, formatKm } from "@/lib/utils/geo";
import type { ConsultType, Doctor } from "@/lib/types/domain";

export default function PatientDoctors() {
  const doctors = useDoctors();
  const { patient } = useCurrentPatient();
  const { createRequest } = useActions();
  const toast = useToast();
  const [symptoms, setSymptoms] = useState("");

  const ranked = [...doctors].sort((a, b) => {
    // online first, then nearest
    if ((a.status === "online") !== (b.status === "online"))
      return a.status === "online" ? -1 : 1;
    return haversineKm(patient, a) - haversineKm(patient, b);
  });

  function book(doctor: Doctor, type: ConsultType) {
    const fee = type === "home_visit" ? doctor.homeVisitFee : doctor.consultFee;
    createRequest({
      patientId: patient.id,
      patientName: patient.name,
      type,
      symptoms: symptoms.trim() || "General consultation.",
      fee,
      address: type === "home_visit" ? patient.address : "Online consult",
      lat: patient.lat,
      lng: patient.lng,
    });
    toast.push({
      tone: "success",
      title: "Request sent to " + doctor.fullName,
      desc: "You'll see it accepted here the moment they respond.",
    });
    setSymptoms("");
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="font-jp text-sm text-salmon">医 · ZUMI</div>
        <h1 className="mt-1 font-serif text-3xl text-cream">Find a doctor</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Nearest, available and transparent — request a video consult or a home
          visit.
        </p>
      </div>

      <div>
        <label className="label">What&apos;s bothering you? (optional)</label>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          rows={2}
          placeholder="e.g. Fever and sore throat for 2 days"
          className="mt-1.5 w-full resize-none rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
        />
      </div>

      {ranked.length === 0 ? (
        <EmptyState kanji="医" title="No doctors on the network yet" />
      ) : (
        <div className="space-y-3">
          {ranked.map((d) => {
            const st = doctorStatus[d.status];
            const online = d.status === "online";
            return (
              <div
                key={d.id}
                className="rounded-card border border-[var(--border)] bg-espresso-800 p-4 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-medium text-cream"
                    style={{ background: d.avatarColor }}
                  >
                    {initials(d.fullName.replace("Dr. ", ""))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium text-cream">{d.fullName}</p>
                      {d.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-status-ok" />}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{d.specialty}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-tan">
                        <Star className="h-3.5 w-3.5 fill-tan" /> {d.rating.toFixed(1)}
                      </span>
                      <span className="text-[var(--text-faint)]">
                        {formatKm(haversineKm(patient, d))} away
                      </span>
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!online}
                    onClick={() => book(d, "video")}
                  >
                    <Video className="h-3.5 w-3.5" /> Video · {formatINR(d.consultFee)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={!online}
                    onClick={() => book(d, "home_visit")}
                  >
                    <Home className="h-3.5 w-3.5" /> Home · {formatINR(d.homeVisitFee)}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
