"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { useConsultRequests, useDoctors } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { tripStageOfRequest } from "@/lib/scheduling/trip";
import type { TripStage } from "@/lib/types/domain";

/**
 * Mounted once in the patient layout. Watches the patient's own visits and
 * fires a notification on the two moments that matter, delivery-app style:
 * the doctor setting off, and the doctor arriving (which the server detects
 * from the doctor's live GPS — no button involved). Renders nothing.
 *
 * First sighting of a request records its stage silently, so reloading the
 * page mid-visit doesn't replay old notifications.
 */
export function ArrivalWatcher() {
  const { patient } = useCurrentPatient();
  const requests = useConsultRequests();
  const doctors = useDoctors();
  const toast = useToast();
  const seen = useRef<Map<string, TripStage | null>>(new Map());

  useEffect(() => {
    for (const r of requests) {
      if (r.patientId !== patient.id) continue;
      const stage = tripStageOfRequest(r);
      const prev = seen.current.get(r.id);
      seen.current.set(r.id, stage);
      if (prev === undefined || prev === stage) continue;

      const doctor = doctors.find((d) => d.id === r.doctorId)?.fullName ?? "Your doctor";

      if (stage === "enroute") {
        // Ask for browser-notification permission at the moment it becomes
        // useful — the doctor has set off, and arrival may land while the
        // patient is in another tab.
        if ("Notification" in window && Notification.permission === "default") {
          void Notification.requestPermission();
        }
        toast.push({
          tone: "info",
          title: `${doctor} is on the way`,
          desc: "Track them live on the map. We'll tell you when they arrive.",
        });
      }

      if (stage === "arrived") {
        toast.push({
          tone: "success",
          title: `${doctor} has arrived`,
          desc: "They're at your door.",
        });
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`${doctor} has arrived`, {
              body: "They're at your door.",
              icon: "/favicon.svg",
            });
          } catch {
            /* some browsers restrict constructor notifications — toast covers it */
          }
        }
      }
    }
  }, [requests, doctors, patient.id, toast]);

  return null;
}
