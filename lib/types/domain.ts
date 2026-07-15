/**
 * Domain types for the Iyashi dashboard.
 * These mirror the Supabase schema (supabase/migrations/0001_init.sql)
 * but are the clean shape the UI consumes. All lib/api + hooks return
 * these, never raw DB rows - one seam for teammates to swap the source.
 */

export type Role = "doctor" | "ops" | "admin";

export type DoctorStatus = "online" | "offline" | "busy";

/**
 * The kind of freelance doctor on the network:
 *  - "resident"   : a licensed junior doctor who is not in a full-time job yet.
 *  - "practising" : a working doctor taking extra visits for side income.
 */
export type DoctorKind = "resident" | "practising";

export type Gender = "female" | "male";

/** How verified a doctor is. Only "verified" doctors may go online. */
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

/** Triage acuity — routes the patient to the right level of care. */
export type Acuity = "emergency" | "urgent" | "routine";

export type SosCategory =
  | "cardiac"
  | "trauma"
  | "respiratory"
  | "stroke"
  | "obstetric"
  | "other";

export type SosStatus =
  | "open"
  | "assigned"
  | "enroute"
  | "resolved"
  | "cancelled";

export type ConsultType = "video" | "home_visit" | "clinic";

export type ConsultStatus =
  | "pending" // waiting for a doctor to accept
  | "accepted" // a doctor claimed it
  | "enroute" // doctor is on the way (home/clinic visits)
  | "arrived" // doctor has reached the patient
  | "declined"
  | "completed"
  | "cancelled";

export type OrderStatus =
  | "placed"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type AmbulanceStatus = "free" | "dispatched" | "busy";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  kind: DoctorKind;
  gender: Gender;
  experienceYears: number;
  languages: string[];
  status: DoctorStatus;
  verified: boolean; // convenience mirror of verificationStatus === "verified"
  verificationStatus: VerificationStatus;
  regNo: string | null; // NMC / state medical council registration number
  rating: number;
  ratingCount: number; // number of reviews behind the rating
  consultFee: number;
  homeVisitFee: number;
  avatarColor: string; // deterministic accent for avatar chips
  lat: number;
  lng: number;
  lastSeen: string; // ISO
}

export interface Ambulance {
  id: string;
  vehicleNo: string;
  driverName: string;
  status: AmbulanceStatus;
  lat: number;
  lng: number;
}

export interface SosEvent {
  id: string;
  patientId?: string | null;
  patientName: string;
  category: SosCategory;
  status: SosStatus;
  address: string;
  lat: number;
  lng: number;
  ambulanceId: string | null;
  doctorId: string | null;
  notes: string | null;
  createdAt: string; // ISO
  resolvedAt: string | null;
}

export interface ConsultRequest {
  id: string;
  patientId?: string | null;
  patientName: string;
  type: ConsultType;
  status: ConsultStatus;
  symptoms: string;
  acuity: Acuity; // from triage — routes to the right level of care
  triageSummary: string | null; // short human-readable triage note
  fee: number;
  address: string;
  lat: number;
  lng: number;
  createdAt: string; // ISO
  acceptedAt: string | null; // when a doctor claimed it (drives ETA)
  etaMins: number | null; // estimated arrival for home/clinic visits
  doctorId: string | null;
}

/** An issued e-prescription — the clinical output of a completed visit. */
export interface Prescription {
  id: string;
  requestId: string;
  patientId?: string | null;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorRegNo: string | null; // shown on every Rx per Telemedicine Guidelines 2020
  diagnosis: string;
  items: { name: string; dosage: string; duration: string }[];
  advice: string;
  createdAt: string; // ISO
}

export interface Order {
  id: string;
  patientId?: string | null;
  patientName: string;
  status: OrderStatus;
  items: { name: string; qty: number }[];
  total: number;
  address: string;
  darkStore: string;
  etaMins: number;
  createdAt: string; // ISO
}

export interface Review {
  id: string;
  doctorId: string | null;
  requestId: string | null;
  patientName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

/** Aggregated KPI snapshot for the ops overview. */
export interface OpsSnapshot {
  activeSos: number;
  ambulancesFree: number;
  ambulancesTotal: number;
  doctorsOnline: number;
  doctorsTotal: number;
  ordersActive: number;
  avgResponseMins: number;
}
