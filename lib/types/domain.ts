/**
 * Domain types for the Doceeto dashboard.
 * The clean shape the UI consumes — all repos and hooks return these,
 * never raw store rows, so there is one seam to swap the source behind
 * (Neo4j, the file store, or the in-browser demo engine).
 */

/** The roles a session can carry. Matches UserRecord["role"] in lib/db/shared.ts. */
export type Role = "patient" | "doctor" | "ops";

export type DoctorStatus = "online" | "offline" | "busy";

/**
 * The kind of freelance doctor on the network:
 *  - "resident"   : a licensed junior doctor who is not in a full-time job yet.
 *  - "practising" : a working doctor taking extra visits for side income.
 */
export type DoctorKind = "resident" | "practising";

export type Gender = "female" | "male";

/** How the patient pays: online (UPI/card, escrowed) or cash on the visit. */
export type PaymentMethod = "online" | "cash";

/** A doctor wallet ledger entry. */
export type TransactionKind = "earning" | "payout";

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

/**
 * How the patient reached this doctor — the three booking paths:
 *  - "emergency" : right now. Broadcast to whoever is free when no doctor is
 *                  named (the Uber path), or sent to one doctor directly.
 *  - "scheduled" : a booked slot on one doctor's calendar.
 *  - "gig"       : a doctor's published service package, hired outright. Holds
 *                  no calendar slot, so an accepted gig occupies the doctor
 *                  until they complete it — that is what pauses their listing.
 */
export type BookingMode = "emergency" | "scheduled" | "gig";

/**
 * A gig listing's lifecycle. Only "active" gigs are hireable; "paused" keeps
 * the listing for the doctor to re-publish, "archived" retires it. Pending
 * hires survive either — the request snapshots the title it was hired under.
 */
export type GigStatus = "active" | "paused" | "archived";

/**
 * A service package a doctor publishes for patients to hire. This is the core
 * of the freelance marketplace: the doctor sets the title, price and duration,
 * rather than the platform deriving an offering from their fee fields.
 */
export interface Gig {
  id: string;
  doctorId: string;
  /** Patient-facing headline, e.g. "Home visit — fever & flu care". */
  title: string;
  description: string;
  /** Where it happens. Reuses the consult types so fees and icons line up. */
  type: ConsultType;
  price: number;
  /** How long the doctor is committed for — minutes, so a 12h shift is 720. */
  durationMinutes: number;
  status: GigStatus;
  createdAt: string; // ISO
  updatedAt: string | null;
}

/**
 * Uber-style progress once a request is accepted, so the patient can watch the
 * doctor approach instead of staring at "accepted". Advances one step at a
 * time, server-derived — see the advanceTrip action.
 */
export type TripStage = "accepted" | "enroute" | "arrived" | "in_progress";

/**
 * One recurring weekly window in which a doctor accepts appointments.
 * `day` is 0 (Sunday) … 6 (Saturday). `start`/`end` are "HH:MM" wall-clock
 * times in the scheduling timezone (see lib/scheduling/time.ts) — never the
 * server's or the browser's local zone, so all three agree on a slot.
 */
export interface AvailabilityWindow {
  day: number;
  start: string;
  end: string;
}

/** A doctor's bookable calendar. Absent on a doctor row = the defaults. */
export interface DoctorAvailability {
  /** Length of one appointment, in minutes. */
  slotMinutes: number;
  /** Recurring weekly windows the grid is cut from. */
  windows: AvailabilityWindow[];
  /** Whole days blocked off, as "YYYY-MM-DD" in the scheduling timezone. */
  daysOff: string[];
  /** How many days ahead patients may book. */
  horizonDays: number;
  /** Minimum notice before the first bookable slot, in minutes. */
  leadMinutes: number;
  /** Whether this doctor takes walk-up emergency consults at all. */
  acceptsEmergency: boolean;
}

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
  clinicAddress?: string; // where the doctor practises — shown to patients, used for clinic visits
  /** Bookable calendar. Undefined = the platform defaults; read it through
   *  availabilityOf() in lib/scheduling/slots.ts, never raw. */
  availability?: DoctorAvailability;
  /**
   * Derived on read, never stored — attached by /api/data so patient-facing
   * lists can show real availability. A patient only ever receives their own
   * requests, so they cannot work this out themselves.
   *
   * Deliberately separate from `status`, which is the doctor's own
   * online/offline intent: being on a gig is machine-derived and self-healing,
   * so a crash mid-gig can never strand someone as permanently unavailable.
   */
  onGig?: boolean;
  /** Mid-consult right now (an accepted emergency, a running slot, or a gig). */
  onConsult?: boolean;
  /** Live gigs this doctor is offering, and the cheapest one's price. */
  gigCount?: number;
  gigFromPrice?: number | null;
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
  paymentMethod?: PaymentMethod; // online (escrowed) or cash on visit
  fee: number;
  address: string;
  lat: number;
  lng: number;
  createdAt: string; // ISO
  /** Which booking path this came from. Rows written before scheduling
   *  existed carry none — read it through bookingModeOf(), never raw. */
  mode?: BookingMode;
  /** The gig that was hired. Null for appointments and broadcasts. */
  gigId?: string | null;
  /** The gig's title at hire time, so later edits don't rewrite history and
   *  the row stays readable after the listing is archived. */
  gigTitle?: string | null;
  /** True when this went out to the pool rather than to one named doctor.
   *  Set at creation and never changed — it decides whether a doctor's
   *  cancellation re-pools the request or simply ends it. */
  broadcast?: boolean;
  /** Where the visit has got to. Null until a doctor accepts. */
  tripStage?: TripStage | null;
  tripStageAt?: string | null;
  /** ISO start of the booked slot. Null/absent for an emergency. */
  scheduledAt?: string | null;
  /** ISO end of the booked slot — scheduledAt + slotMinutes. */
  scheduledEnd?: string | null;
  /** Length of the booked slot, in minutes. */
  slotMinutes?: number | null;
  /** When a doctor claimed it — createdAt→acceptedAt is the response time. */
  acceptedAt?: string | null;
  /** When the consult was closed out; dates the doctor's "today" counts. */
  completedAt?: string | null;
  /** When the patient or doctor called it off, freeing the slot. */
  cancelledAt?: string | null;
  /** Which side called it off. A doctor must give a reason; a patient needn't. */
  cancelledBy?: "patient" | "doctor" | null;
  cancelReason?: string | null;
  /** Doctors who passed on this broadcast — they are never offered it again.
   *  Persisted so a pass survives a refresh, and so a doctor who cancels an
   *  accepted broadcast doesn't immediately see it back in their feed. */
  passedBy?: string[];
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

/** A doctor's wallet ledger entry — an earning from a completed visit, or a
 *  payout withdrawn to their bank. Net moves the wallet balance. */
export interface Transaction {
  id: string;
  doctorId: string;
  kind: TransactionKind;
  requestId: string | null;
  patientName: string | null;
  method: PaymentMethod | null;
  gross: number; // fee before commission (earnings)
  commission: number; // platform cut (earnings)
  net: number; // +earning to wallet, -payout from wallet
  createdAt: string; // ISO
}

/** Aggregated KPI snapshot for the ops overview. */
export interface OpsSnapshot {
  doctorsOnline: number;
  doctorsTotal: number;
  ordersActive: number;
}
