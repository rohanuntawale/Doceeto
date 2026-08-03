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

// The old engagement-style "health score" that lived here (points for using
// the app recently) is gone — the real one, computed from the patient's
// actual health data and care history, lives in lib/health/score.ts.
