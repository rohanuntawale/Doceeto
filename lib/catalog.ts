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

/**
 * A small OTC/common-med catalog for the patient medicine flow.
 *
 * `price` is per PACK, and `packSize` says how many doses are in one — a strip
 * of ten tablets, a box of six sachets, one inhaler. Fulfilment needs both to
 * turn "1-0-1 for five days" into something that can actually be dispensed
 * (see lib/medicine/fulfilment.ts); a course of ten tablets is one strip, not
 * ten purchases. `molecule` is what a prescription is matched on, since a
 * doctor writes the drug and not the packaging.
 */
export const MED_CATALOG = [
  { name: "Paracetamol 650mg", price: 45, molecule: "paracetamol", packSize: 10, form: "tablet" },
  { name: "Azithromycin 500mg", price: 120, molecule: "azithromycin", packSize: 5, form: "tablet" },
  { name: "Cetirizine 10mg", price: 30, molecule: "cetirizine", packSize: 10, form: "tablet" },
  { name: "ORS sachets", price: 25, molecule: "ors", packSize: 6, form: "sachet" },
  { name: "Pantoprazole 40mg", price: 85, molecule: "pantoprazole", packSize: 15, form: "tablet" },
  { name: "Vitamin D3 sachets", price: 90, molecule: "vitamin d3", packSize: 4, form: "sachet" },
  { name: "Salbutamol inhaler", price: 210, molecule: "salbutamol", packSize: 1, form: "inhaler" },
  { name: "Amlodipine 5mg", price: 60, molecule: "amlodipine", packSize: 15, form: "tablet" },
];

export type CatalogItem = (typeof MED_CATALOG)[number];

/** Deterministic avatar hues for newly registered doctors (Mori palette). */
export const AVATAR_COLORS = [
  "#BB4A2A",
  "#C6A64C",
  "#5D8A6E",
  "#69756A",
  "#8A6F52",
];
