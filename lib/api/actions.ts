/**
 * LIVE-path mutations (Supabase). The demo path mutates the in-memory
 * store instead; both are exposed through the same useActions() hook
 * shape in lib/hooks/data.ts, so components never know which is active.
 */
import { getSupabaseBrowser } from "@/lib/supabase/client";

// ── Patient-side creates (the connection into the consoles) ──
export async function liveCreateSos(input: {
  patientId: string;
  patientName: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  notes?: string;
}) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from("sos_events").insert({
    patient_name: input.patientName,
    category: input.category,
    status: "open",
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    notes: input.notes ?? "Patient-triggered SOS.",
  });
}

export async function liveCreateRequest(input: {
  patientId: string;
  patientName: string;
  type: string;
  symptoms: string;
  fee: number;
  address: string;
  lat: number;
  lng: number;
}) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from("consult_requests").insert({
    patient_name: input.patientName,
    type: input.type,
    status: "pending",
    symptoms: input.symptoms,
    fee: input.fee,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
  });
}

export async function liveCreateOrder(input: {
  patientId: string;
  patientName: string;
  items: { name: string; qty: number }[];
  total: number;
  address: string;
  darkStore: string;
}) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from("orders").insert({
    patient_name: input.patientName,
    status: "placed",
    items: input.items,
    total: input.total,
    address: input.address,
    dark_store: input.darkStore,
    eta: 10,
  });
}

export async function liveSetDoctorStatus(id: string, status: string) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb
    .from("doctors")
    .update({ status, last_seen: new Date().toISOString() })
    .eq("id", id);
}

export async function liveUpdateDoctor(
  id: string,
  patch: {
    fullName?: string;
    specialty?: string;
    consultFee?: number;
    homeVisitFee?: number;
  },
) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const row: Record<string, unknown> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.specialty !== undefined) row.specialty = patch.specialty;
  if (patch.consultFee !== undefined) row.consult_fee = patch.consultFee;
  if (patch.homeVisitFee !== undefined) row.home_visit_fee = patch.homeVisitFee;
  await sb.from("doctors").update(row).eq("id", id);
}

export async function liveAcceptRequest(id: string, doctorId: string) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb
    .from("consult_requests")
    .update({ status: "accepted", doctor_id: doctorId })
    .eq("id", id);
}

export async function liveDeclineRequest(id: string) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from("consult_requests").update({ status: "declined" }).eq("id", id);
}

export async function liveCompleteRequest(id: string) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from("consult_requests").update({ status: "completed" }).eq("id", id);
}

export async function liveAssignAmbulance(sosId: string, ambulanceId: string) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb
    .from("sos_events")
    .update({ ambulance_id: ambulanceId, status: "assigned" })
    .eq("id", sosId);
  await sb.from("ambulances").update({ status: "dispatched" }).eq("id", ambulanceId);
}

export async function liveAssignDoctorToSos(sosId: string, doctorId: string) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from("sos_events").update({ doctor_id: doctorId }).eq("id", sosId);
}

export async function liveAdvanceSos(sosId: string, next: string) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const patch: Record<string, unknown> = { status: next };
  if (next === "resolved") patch.resolved_at = new Date().toISOString();
  await sb.from("sos_events").update(patch).eq("id", sosId);
}

export async function liveAdvanceOrder(orderId: string, next: string) {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from("orders").update({ status: next }).eq("id", orderId);
}
