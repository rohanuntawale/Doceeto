"use client";

/**
 * A doctor's bookable calendar, from whichever backend is live.
 *
 * In LIVE mode the grid has to come from the server: a patient only ever
 * receives their own requests, so the browser cannot see which slots other
 * patients hold. In DEMO mode the in-browser store has everything, so the
 * same functions run locally and produce an identical shape.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { useConsultRequests, useDoctors } from "@/lib/hooks/data";
import {
  bookableState,
  buildSchedule,
  busyIntervals,
  DEFAULT_AVAILABILITY,
  type BookableState,
  type DayView,
} from "@/lib/scheduling/slots";

/**
 * Everything the booking surfaces need: the bookable flags from
 * `bookableState` plus the cut calendar. Extending BookableState keeps the
 * server response and this hook in lockstep by construction — a flag added
 * there shows up here without a second declaration to forget.
 */
export interface DoctorSchedule extends BookableState {
  /** Bookable days, soonest first. Days with no windows are omitted. */
  days: DayView[];
  loading: boolean;
}

const EMPTY: DoctorSchedule = {
  availability: DEFAULT_AVAILABILITY,
  days: [],
  takesAppointments: false,
  emergencyAvailable: false,
  appointmentsOpen: false,
  gigsHireable: false,
  onConsult: false,
  onGig: false,
  activeGigId: null,
  loading: true,
};

// Slots are claimed by other patients between renders, so the grid is
// refetched on a short interval while a picker is open.
const SCHEDULE_POLL_MS = 15_000;

export function useDoctorSchedule(doctorId?: string | null): DoctorSchedule {
  const doctors = useDoctors();
  const requests = useConsultRequests();
  const doctor = doctors.find((d) => d.id === doctorId);

  const { data, isPending } = useQuery({
    queryKey: ["availability", doctorId],
    enabled: !isDemoMode && Boolean(doctorId),
    refetchInterval: SCHEDULE_POLL_MS,
    queryFn: async (): Promise<Omit<DoctorSchedule, "loading">> => {
      const res = await fetch(`/api/availability?doctorId=${encodeURIComponent(doctorId!)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load the schedule.");
      return res.json();
    },
  });

  // Demo path: the store holds every request, so the grid is cut locally
  // with the very same helpers the server uses.
  const local = useMemo<DoctorSchedule | null>(() => {
    if (!isDemoMode || !doctorId) return null;
    const state = bookableState(doctor, requests);
    return {
      ...state,
      days: buildSchedule(state.availability, { busy: busyIntervals(requests, doctorId) }),
      loading: false,
    };
  }, [doctor, doctorId, requests]);

  if (local) return local;
  if (!doctorId) return { ...EMPTY, loading: false };
  return data ? { ...data, loading: false } : { ...EMPTY, loading: isPending };
}
