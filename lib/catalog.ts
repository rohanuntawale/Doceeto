/**
 * Product catalog CONFIG shared by client AND server (no demo data).
 * The server prices orders from MED_CATALOG so clients can't invent totals.
 */

/** AuraMed dark stores (fulfilment infrastructure, Nagpur). */
export const DARK_STORES = [
  "Doceeto Store · Dharampeth",
  "Doceeto Store · Sitabuldi",
  "Doceeto Store · Sadar",
  "Doceeto Store · Manish Nagar",
];

/** A small OTC/common-med catalog for the patient medicine flow. */
export const MED_CATALOG = [
  { name: "Paracetamol 650mg", price: 45 },
  { name: "Azithromycin 500mg", price: 120 },
  { name: "Cetirizine 10mg", price: 30 },
  { name: "ORS sachets", price: 25 },
  { name: "Pantoprazole 40mg", price: 85 },
  { name: "Vitamin D3 sachets", price: 90 },
  { name: "Salbutamol inhaler", price: 210 },
  { name: "Amlodipine 5mg", price: 60 },
];

/** Deterministic avatar hues for newly registered doctors (Mori palette). */
export const AVATAR_COLORS = [
  "#BB4A2A",
  "#C6A64C",
  "#5D8A6E",
  "#69756A",
  "#8A6F52",
];
