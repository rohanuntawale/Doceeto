/**
 * Row → domain mappers for the LIVE (Supabase) path. Rows are snake_case
 * from Postgres; the UI only ever sees the camelCase domain types.
 */
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
  Order,
  Review,
  SosEvent,
} from "@/lib/types/domain";

// Rows arrive untyped from Postgres; this keeps mappers readable
// without pulling in the full typescript-eslint plugin.
type Row = Record<string, any>;

const AVATAR = ["#C15A38", "#C9A876", "#7C8B63", "#E0A890", "#8A6F52"];
const pickColor = (id: string) =>
  AVATAR[Math.abs(hash(id)) % AVATAR.length];

export function mapDoctor(r: Row): Doctor {
  return {
    id: r.id,
    fullName: r.full_name ?? r.profiles?.full_name ?? "Doctor",
    specialty: r.specialty ?? "General Physician",
    status: r.status ?? "offline",
    verified: !!r.verified,
    rating: Number(r.rating ?? 0),
    consultFee: r.consult_fee ?? 0,
    homeVisitFee: r.home_visit_fee ?? 0,
    avatarColor: pickColor(r.id),
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? 0),
    lastSeen: r.last_seen ?? new Date().toISOString(),
  };
}

export function mapAmbulance(r: Row): Ambulance {
  return {
    id: r.id,
    vehicleNo: r.vehicle_no,
    driverName: r.driver_name,
    status: r.status,
    lat: Number(r.lat),
    lng: Number(r.lng),
  };
}

export function mapSos(r: Row): SosEvent {
  return {
    id: r.id,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name ?? "Unknown",
    category: r.category,
    status: r.status,
    address: r.address ?? "",
    lat: Number(r.lat),
    lng: Number(r.lng),
    ambulanceId: r.ambulance_id,
    doctorId: r.doctor_id,
    notes: r.notes,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export function mapRequest(r: Row): ConsultRequest {
  return {
    id: r.id,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name ?? "Patient",
    type: r.type,
    status: r.status,
    symptoms: r.symptoms ?? "",
    fee: r.fee ?? 0,
    address: r.address ?? "",
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? 0),
    createdAt: r.created_at,
    doctorId: r.doctor_id,
  };
}

export function mapOrder(r: Row): Order {
  return {
    id: r.id,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name ?? "Patient",
    status: r.status,
    items: r.items ?? [],
    total: r.total ?? 0,
    address: r.address ?? "",
    darkStore: r.dark_store ?? "",
    etaMins: r.eta ?? 0,
    createdAt: r.created_at,
  };
}

export function mapReview(r: Row): Review {
  return {
    id: r.id,
    patientName: r.patient_name ?? "Patient",
    rating: r.rating,
    comment: r.comment ?? "",
    createdAt: r.created_at,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
