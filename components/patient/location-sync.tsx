"use client";

import { useEffect } from "react";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { updatePatient } from "@/lib/hooks/use-current-patient";

/**
 * Mounted once in the patient layout. Streams the device's real
 * position into the shared patient identity, so the doctor map centers
 * on the true location and every request / order carries real
 * coordinates. Renders nothing.
 */
export function PatientLocationSync() {
  const geo = useGeolocation({ minMoveMeters: 25 });

  useEffect(() => {
    if (geo.status === "granted" && geo.lat != null && geo.lng != null) {
      updatePatient({ lat: geo.lat, lng: geo.lng, located: true });
    }
  }, [geo.status, geo.lat, geo.lng]);

  return null;
}
