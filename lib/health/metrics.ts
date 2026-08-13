/**
 * Weekly dashboard metrics, derived from real data — the symptom-check
 * history, the patient's own consult requests, their medicine orders, and a
 * provider's wallet ledger. Nothing here is decorative: every number the
 * "Care activity" and "Earnings this week" cards show traces back to a stored
 * event.
 *
 * Pure and dependency-free, so both the live and demo paths share it, `now` is
 * injectable, and it is trivially unit-testable.
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

/**
 * A percentage change past this is noise, not information.
 *
 * Going from ₹50 last week to ₹5,000 this week is +9,900%, which tells the
 * reader nothing they didn't get from the bars and makes the badge look
 * broken. Clamped, it reads as "way up", which is the actual message.
 */
const TREND_CAP = 999;

export interface WeeklySeries {
  /** Value per day, Sunday → Saturday of the current week. */
  data: number[];
  /** Total so far this week. */
  total: number;
  /**
   * Percent change against the SAME PORTION of last week, or `null` when
   * there is nothing meaningful to compare against (both periods empty).
   *
   * Null rather than 0: "0%" is a measurement, and claiming to have measured
   * no change between two weeks of nothing is worse than saying nothing. The
   * cards hide the badge on null.
   */
  trend: number | null;
  /** Days of the current week that have actually happened, 1–7. */
  elapsedDays: number;
}

/** One thing that happened, and optionally how much it was worth. */
export interface WeeklyEvent {
  /** Epoch ms. */
  at: number;
  /** Summed when present; each event otherwise counts as 1. */
  value?: number;
}

/**
 * Bucket events into this week's days and compare like with like.
 *
 * ── The bug this replaces ──
 *
 * Both dashboards used to compare an INCOMPLETE period against a COMPLETE
 * one, which guarantees a negative number that has nothing to do with how
 * anyone is doing:
 *
 *   • The doctor's earnings card compared TODAY against the average of the six
 *     days before it. Every morning began at "↓ 100%" and recovered over the
 *     day. On a Saturday with no work yet, that is exactly what the badge said
 *     — while the chart beside it showed a good Friday.
 *   • The patient's activity card compared a part-week against all of last
 *     week. On Monday morning that is one day against seven.
 *
 * ── What it does instead ──
 *
 * Week-to-date against the same slice of last week: Sunday→now, versus
 * Sunday→the same weekday and time seven days earlier. Both windows are the
 * same length by construction, so the comparison is fair on a Monday morning
 * and on a Saturday night, and it describes exactly the period the seven bars
 * are showing.
 */
export function weeklySeries(events: WeeklyEvent[], now = Date.now()): WeeklySeries {
  const weekStart = startOfWeek(now);
  const lastWeekStart = weekStart - 7 * DAY_MS;
  // How far into the week we are. This is the width of BOTH comparison
  // windows — the whole point of the fix.
  const elapsed = now - weekStart;
  const lastWeekEnd = lastWeekStart + elapsed;

  const data = Array(7).fill(0) as number[];
  let priorTotal = 0;

  for (const event of events) {
    const at = event.at;
    if (!Number.isFinite(at)) continue;
    const amount = event.value ?? 1;
    if (!Number.isFinite(amount)) continue;

    if (at >= weekStart && at <= now) {
      data[Math.min(6, Math.floor((at - weekStart) / DAY_MS))] += amount;
    } else if (at >= lastWeekStart && at < lastWeekEnd) {
      priorTotal += amount;
    }
  }

  const total = data.reduce((a, b) => a + b, 0);
  const trend =
    priorTotal > 0
      ? Math.max(
          -TREND_CAP,
          Math.min(TREND_CAP, Math.round(((total - priorTotal) / priorTotal) * 100)),
        )
      : // Nothing last week. Something this week is a genuine start, not an
        // infinite percentage; nothing either week is not a measurement at all.
        total > 0
        ? 100
        : null;

  return {
    data,
    total,
    trend,
    elapsedDays: Math.min(7, Math.floor(elapsed / DAY_MS) + 1),
  };
}

/**
 * Count care events (visits booked, symptom checks run, orders placed) per day
 * this week. A thin wrapper over weeklySeries for the common "just count them"
 * case.
 */
export function weeklyCareActivity(eventTimes: number[], now = Date.now()): WeeklySeries {
  return weeklySeries(
    eventTimes.map((at) => ({ at })),
    now,
  );
}

// The old engagement-style "health score" that lived here (points for using
// the app recently) is gone — the real one, computed from the patient's
// actual health data and care history, lives in lib/health/score.ts.
