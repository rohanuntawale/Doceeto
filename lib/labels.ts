import type {
  ConsultStatus,
  ConsultType,
  DoctorStatus,
  OrderStatus,
  SosCategory,
  SosStatus,
} from "@/lib/types/domain";

type Tone = "critical" | "warn" | "ok" | "idle" | "info";

export const sosCategory: Record<SosCategory, { label: string; kanji: string }> = {
  cardiac: { label: "Cardiac", kanji: "心" },
  trauma: { label: "Trauma", kanji: "傷" },
  respiratory: { label: "Respiratory", kanji: "肺" },
  stroke: { label: "Stroke", kanji: "脳" },
  obstetric: { label: "Obstetric", kanji: "産" },
  other: { label: "Other", kanji: "他" },
};

export const sosStatus: Record<SosStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "critical" },
  assigned: { label: "Assigned", tone: "warn" },
  enroute: { label: "En route", tone: "info" },
  resolved: { label: "Resolved", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

export const consultStatus: Record<ConsultStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warn" },
  accepted: { label: "Accepted", tone: "info" },
  declined: { label: "Declined", tone: "idle" },
  completed: { label: "Completed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

export const consultType: Record<ConsultType, { label: string }> = {
  video: { label: "Video consult" },
  home_visit: { label: "Home visit" },
  clinic: { label: "Clinic visit" },
};

export const orderStatus: Record<OrderStatus, { label: string; tone: Tone; step: number }> = {
  placed: { label: "Placed", tone: "warn", step: 0 },
  packed: { label: "Packed", tone: "info", step: 1 },
  out_for_delivery: { label: "Out for delivery", tone: "info", step: 2 },
  delivered: { label: "Delivered", tone: "ok", step: 3 },
  cancelled: { label: "Cancelled", tone: "idle", step: 0 },
};

export const doctorStatus: Record<DoctorStatus, { label: string; tone: Tone }> = {
  online: { label: "Online", tone: "ok" },
  busy: { label: "Busy", tone: "warn" },
  offline: { label: "Offline", tone: "idle" },
};
