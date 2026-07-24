/**
 * Domain types for the Doceeto dashboard.
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
  | "pending"
  | "accepted"
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
  verified: boolean;
  rating: number;
  consultFee: number;
  homeVisitFee: number;
  avatarColor: string; // deterministic accent for avatar chips
  lat: number;
  lng: number;
  lastSeen: string; // ISO
  // Patient-facing profile detail. Optional: seeded doctors carry rich data;
  // registered doctors fall back to specialty-derived defaults (see
  // lib/utils/doctor.ts) until they fill their profile.
  qualifications?: string; // e.g. "MBBS, MD (General Medicine)"
  education?: string; // academic background, e.g. "Seth GS Medical College, Mumbai"
  about?: string; // short bio
  registrationNo?: string; // medical council registration
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
  fee: number;
  address: string;
  lat: number;
  lng: number;
  createdAt: string; // ISO
  doctorId: string | null;
  // Mutual-rating context (attached on reads, doctor-facing):
  /** The patient's aggregate rating from past doctors, if any. */
  patientRating?: number | null;
  patientRatingCount?: number;
  /** True once the doctor has rated the patient for this consult. */
  patientRated?: boolean;
  /** True once the patient has reviewed the doctor for this consult. */
  reviewed?: boolean;
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
