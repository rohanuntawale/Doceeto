/**
 * Patient dashboard metrics, derived from real care data — the symptom-check
 * history, the patient's own consult requests, and their medicine orders.
 * Nothing here is decorative: every number the "Care activity" and "Health
 * score" cards show traces back to a stored event.
 *
 * Pure and dependency-free, so both the live and demo paths share it and it
 * is trivially unit-testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the local calendar day, as epoch ms. */
function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Start of the week (Sunday) containing `t` — matches the S M T W T F S axis. */
function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  return d.getTime() - d.getDay() * DAY_MS;
}

export interface WeeklyActivity {
  /** Events per day, Sunday → Saturday of the current week. */
  data: number[];
  /** % change of this week's total vs last week's. */
  trend: number;
  total: number;
}

/**
 * Bucket care events (visits booked, symptom checks run, orders placed) into
 * this week's days. The trend compares against the full previous week.
 */
export function weeklyCareActivity(eventTimes: number[], now = Date.now()): WeeklyActivity {
  const thisWeek = startOfWeek(now);
  const lastWeek = thisWeek - 7 * DAY_MS;

  const data = Array(7).fill(0) as number[];
  let lastWeekTotal = 0;
  for (const t of eventTimes) {
    if (!Number.isFinite(t)) continue;
    if (t >= thisWeek && t < thisWeek + 7 * DAY_MS) {
      data[Math.min(6, Math.floor((t - thisWeek) / DAY_MS))]++;
    } else if (t >= lastWeek && t < thisWeek) {
      lastWeekTotal++;
    }
  }
  const total = data.reduce((a, b) => a + b, 0);
  const trend =
    lastWeekTotal === 0
      ? total > 0
        ? 100
        : 0
      : Math.round(((total - lastWeekTotal) / lastWeekTotal) * 100);
  return { data, trend, total };
}

export interface HealthSignals {
  /** Address (and so location for visits) is on file. */
  profileComplete: boolean;
  /** Epoch-ms times of finished symptom checks. */
  checkTimes: number[];
  /** Epoch-ms times of COMPLETED consults (a doctor actually saw them). */
  completedConsultTimes: number[];
  /** Epoch-ms times of medicine orders. */
  orderTimes: number[];
}

export interface HealthScore {
  value: number;
  /** Change vs the score as it stood 7 days ago. */
  trend: number;
  caption: string;
  /** The score recomputed at each of the last 7 days — a real sparkline. */
  spark: number[];
}

/**
 * An engagement-style wellness score with a transparent formula:
 *
 *   35  base
 *  +15  profile complete (we can reach and locate them)
 *  +20  recent symptom check   (≤30 days; ≤90 days earns +10)
 *  +20  recent completed consult (≤90 days; ever earns +10)
 *  +10  medicine ordered ≤30 days
 *
 * Capped to 5–100. It rewards staying on top of your care, which is the only
 * thing the app can honestly measure — it is NOT a clinical judgement.
 */
export function healthScoreAt(s: HealthSignals, at: number): number {
  const within = (times: number[], days: number) =>
    times.some((t) => Number.isFinite(t) && t <= at && at - t <= days * DAY_MS);

  let score = 35;
  if (s.profileComplete) score += 15;
  if (within(s.checkTimes, 30)) score += 20;
  else if (within(s.checkTimes, 90)) score += 10;
  if (within(s.completedConsultTimes, 90)) score += 20;
  else if (s.completedConsultTimes.some((t) => t <= at)) score += 10;
  if (within(s.orderTimes, 30)) score += 10;
  return Math.max(5, Math.min(100, score));
}

export function healthScore(s: HealthSignals, now = Date.now()): HealthScore {
  const value = healthScoreAt(s, now);
  const weekAgo = healthScoreAt(s, now - 7 * DAY_MS);
  const spark = Array.from({ length: 7 }, (_, i) => healthScoreAt(s, now - (6 - i) * DAY_MS));
  const caption =
    value >= 75 ? "Looking good" : value >= 50 ? "Keeping steady" : "Check in with a doctor";
  return { value, trend: value - weekAgo, caption, spark };
}
