/**
 * Prescription → medicine basket. The delivery half of a prescription.
 *
 * ⚠ NO UI YET. Medicine ordering is dark for patients (MEDICINE_ENABLED in
 * lib/config.ts), so nothing in the app renders a basket today. This module and
 * the `orderFromPrescription` action exist so that turning the flag on is the
 * only work left: the pricing, the pack maths and the "we don't stock that"
 * path are already decided and already tested by the same catalog the store
 * page prices from.
 *
 * Pure and server-safe: no store access, no session, no side effects. The
 * action layer owns authorization; this owns arithmetic.
 */
import { MED_CATALOG, DARK_STORES, type CatalogItem } from "@/lib/catalog";
import { courseUnits } from "@/lib/prescriptions/rules";
import type { Prescription, RxItem } from "@/lib/types/domain";

/** One prescribed medicine, resolved against what the dark stores hold. */
export interface RxBasketLine {
  /** The prescribed line, verbatim — never rewritten to match the catalog. */
  item: RxItem;
  /** The catalog product it maps to, or null when nothing stocks it. */
  catalogName: string | null;
  /** Units the whole course needs, e.g. 10 tablets for 1-0-1 over five days. */
  unitsNeeded: number;
  /** Packs to dispense — units rounded UP to whole strips/boxes. */
  packs: number;
  packSize: number;
  /** Price of one pack, in rupees. */
  packPrice: number;
  lineTotal: number;
  available: boolean;
}

export interface RxBasket {
  prescriptionId: string;
  code: string;
  lines: RxBasketLine[];
  /**
   * Exactly the shape repo.createOrder takes, so the order path is the same one
   * the store page uses — the server still re-prices from the catalog, and a
   * basket built here can never name its own total.
   */
  items: { name: string; qty: number }[];
  /** Indicative total. The authority is the repo's own re-pricing on write. */
  subtotal: number;
  availableCount: number;
  /** Prescribed medicines the network cannot supply — the patient is told. */
  unavailable: string[];
  /** True when at least one line can actually be delivered. */
  fulfillable: boolean;
}

/** Lowercase, punctuation-free, strength stripped: "Paracetamol 650mg" → "paracetamol". */
function molecularKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)/g, " ")
    .replace(/\b(tab|tablet|tablets|cap|capsule|capsules|syrup|susp|suspension|inj|injection|drops?)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The catalog product for a prescribed medicine, or null.
 *
 * Exact product name first (a doctor picking from the catalog chips writes it
 * verbatim), then the molecule. Nothing fuzzier than that on purpose: guessing
 * that "Amlodipine" means "Amoxicillin" because the letters are close would
 * dispense the wrong drug, and a "we don't stock that" line is always the safer
 * failure.
 */
export function matchCatalog(name: string): CatalogItem | null {
  const raw = name.trim().toLowerCase();
  const exact = MED_CATALOG.find((m) => m.name.toLowerCase() === raw);
  if (exact) return exact;
  const key = molecularKey(name);
  if (!key) return null;
  return (
    MED_CATALOG.find((m) => m.molecule === key) ??
    MED_CATALOG.find((m) => key.startsWith(m.molecule) || m.molecule.startsWith(key)) ??
    null
  );
}

/** Price one prescribed line against the catalog. */
export function priceLine(item: RxItem): RxBasketLine {
  const cat = matchCatalog(item.name);
  const unitsNeeded = courseUnits(item);
  if (!cat) {
    return {
      item,
      catalogName: null,
      unitsNeeded,
      packs: 0,
      packSize: 0,
      packPrice: 0,
      lineTotal: 0,
      available: false,
    };
  }
  // Round UP: half a strip cannot be dispensed, and short-supplying a course is
  // worse than the patient having two tablets spare.
  const packs = Math.max(1, Math.ceil(unitsNeeded / Math.max(1, cat.packSize)));
  return {
    item,
    catalogName: cat.name,
    unitsNeeded,
    packs,
    packSize: cat.packSize,
    packPrice: cat.price,
    lineTotal: packs * cat.price,
    available: true,
  };
}

/**
 * The whole prescription as a deliverable basket.
 *
 * Unstocked medicines are reported, never silently dropped — a patient who
 * ordered off a prescription must be able to see which two of five items they
 * still have to buy elsewhere.
 */
export function basketFor(rx: Prescription): RxBasket {
  const lines = rx.items.map(priceLine);
  const usable = lines.filter((l) => l.available);
  return {
    prescriptionId: rx.id,
    code: rx.code,
    lines,
    items: usable.map((l) => ({ name: l.catalogName as string, qty: l.packs })),
    subtotal: usable.reduce((a, l) => a + l.lineTotal, 0),
    availableCount: usable.length,
    unavailable: lines.filter((l) => !l.available).map((l) => l.item.name),
    fulfillable: usable.length > 0,
  };
}

/**
 * Which dark store fills this. Deterministic on the prescription id rather than
 * random, so a retried order does not bounce between stores and an ops operator
 * chasing a delivery always finds it in the same place.
 */
export function darkStoreFor(prescriptionId: string): string {
  let h = 0;
  for (let i = 0; i < prescriptionId.length; i++) h = (h * 31 + prescriptionId.charCodeAt(i)) >>> 0;
  return DARK_STORES[h % DARK_STORES.length];
}
