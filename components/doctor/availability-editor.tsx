"use client";

/**
 * Where a doctor decides when they can be booked.
 *
 * Everything here is edited as plain wall-clock text and handed to
 * normalizeAvailability() on save — the same function the slot grid and the
 * server validator use — so whatever the editor accepts is exactly what
 * patients will be offered. Overlapping windows are fused rather than
 * rejected, which is why "09:00–13:00" and "12:00–14:00" quietly become one.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Copy, Save, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useActions } from "@/lib/hooks/data";
import {
  availabilityOf,
  normalizeAvailability,
  slotsForDay,
  SLOT_CHOICES,
  MAX_HORIZON_DAYS,
} from "@/lib/scheduling/slots";
import {
  addDaysToKey,
  dateKeyOf,
  formatDayShort,
  parseHm,
  weekdayOfKey,
  WEEKDAY_LABELS,
} from "@/lib/scheduling/time";
import { cn } from "@/lib/utils/cn";
import type { AvailabilityWindow, Doctor, DoctorAvailability } from "@/lib/types/domain";

const LEAD_CHOICES = [
  { value: 0, label: "None" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "1 day" },
];

const HORIZON_CHOICES = [3, 7, 14, 21, MAX_HORIZON_DAYS];

export function AvailabilityEditor({ doctor }: { doctor: Doctor }) {
  const { setAvailability } = useActions();
  const toast = useToast();
  const [form, setForm] = useState<DoctorAvailability>(() => availabilityOf(doctor));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pull in changes made elsewhere (another tab, another device) — but never
  // over the top of edits in progress.
  const stored = JSON.stringify(doctor.availability ?? null);
  useEffect(() => {
    if (!dirty) setForm(availabilityOf(doctor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, doctor.id]);

  const patch = (next: Partial<DoctorAvailability>) => {
    setForm((f) => ({ ...f, ...next }));
    setDirty(true);
  };

  const setWindows = (windows: AvailabilityWindow[]) => patch({ windows });

  /** Slots per day of the week, as the patient will see them. */
  const preview = useMemo(() => {
    const normalized = normalizeAvailability(form);
    const todayKey = dateKeyOf(new Date());
    const counts: number[] = [];
    for (let day = 0; day < 7; day++) {
      // Find the next calendar date that falls on this weekday, so the count
      // reflects the real grid rather than an abstract one.
      const ahead = (day - weekdayOfKey(todayKey) + 7) % 7;
      const key = addDaysToKey(todayKey, ahead);
      counts[day] = slotsForDay({ ...normalized, daysOff: [] }, key).length;
    }
    return counts;
  }, [form]);

  const totalSlots = preview.reduce((a, n) => a + n, 0);

  async function save() {
    setSaving(true);
    try {
      await setAvailability(doctor.id, normalizeAvailability(form));
      setDirty(false);
      toast.push({
        tone: "success",
        title: "Schedule saved",
        desc: `${totalSlots} bookable slot${totalSlots === 1 ? "" : "s"} a week.`,
      });
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Couldn't save your schedule",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Slot shape ────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Appointment length">
          <select
            value={form.slotMinutes}
            onChange={(e) => patch({ slotMinutes: Number(e.target.value) })}
            className={inputCls}
          >
            {SLOT_CHOICES.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notice you need">
          <select
            value={form.leadMinutes}
            onChange={(e) => patch({ leadMinutes: Number(e.target.value) })}
            className={inputCls}
          >
            {LEAD_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bookable up to">
          <select
            value={form.horizonDays}
            onChange={(e) => patch({ horizonDays: Number(e.target.value) })}
            className={inputCls}
          >
            {HORIZON_CHOICES.map((d) => (
              <option key={d} value={d}>
                {d} days ahead
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* ── Weekly hours ──────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="label">Weekly hours</div>
          <span className="text-xs text-[var(--text-faint)]">
            {totalSlots} slot{totalSlots === 1 ? "" : "s"} a week
          </span>
        </div>
        <div className="space-y-2">
          {WEEKDAY_LABELS.map((name, day) => {
            const mine = form.windows
              .map((w, i) => ({ w, i }))
              .filter(({ w }) => w.day === day);
            return (
              <div
                key={day}
                className="rounded-lg border border-[var(--border)] bg-espresso p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-cream">
                    {name}
                    {mine.length === 0 ? (
                      <span className="text-xs font-normal text-[var(--text-faint)]">
                        Closed
                      </span>
                    ) : (
                      <span className="text-xs font-normal text-salmon">
                        {preview[day]} slot{preview[day] === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {mine.length > 0 && (
                      <button
                        type="button"
                        title="Copy these hours to every other day"
                        onClick={() =>
                          setWindows([
                            ...form.windows.filter((w) => w.day === day),
                            ...Array.from({ length: 7 }, (_, d) => d)
                              .filter((d) => d !== day)
                              .flatMap((d) =>
                                mine.map(({ w }) => ({ ...w, day: d })),
                              ),
                          ])
                        }
                        className="rounded-md p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title={`Add hours on ${name}`}
                      onClick={() =>
                        setWindows([
                          ...form.windows,
                          { day, start: mine.length ? "17:00" : "09:00", end: mine.length ? "20:00" : "13:00" },
                        ])
                      }
                      className="rounded-md p-1.5 text-salmon transition-colors hover:bg-terracotta/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {mine.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {mine.map(({ w, i }) => {
                      const bad =
                        parseHm(w.start) === null ||
                        parseHm(w.end) === null ||
                        (parseHm(w.end) ?? 0) <= (parseHm(w.start) ?? 0);
                      return (
                        // flex-wrap: two native time inputs + the delete button
                        // exceed a 360px phone's column; the row must break
                        // instead of overflowing the card.
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            value={w.start}
                            onChange={(e) =>
                              setWindows(
                                form.windows.map((x, xi) =>
                                  xi === i ? { ...x, start: e.target.value } : x,
                                ),
                              )
                            }
                            className={cn(timeCls, bad && "border-status-critical/60")}
                          />
                          <span className="text-xs text-[var(--text-faint)]">to</span>
                          <input
                            type="time"
                            value={w.end}
                            onChange={(e) =>
                              setWindows(
                                form.windows.map((x, xi) =>
                                  xi === i ? { ...x, end: e.target.value } : x,
                                ),
                              )
                            }
                            className={cn(timeCls, bad && "border-status-critical/60")}
                          />
                          <button
                            type="button"
                            title="Remove"
                            onClick={() => setWindows(form.windows.filter((_, xi) => xi !== i))}
                            className="rounded-md p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-status-critical"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {bad && (
                            <span className="w-full text-[11px] text-status-critical">
                              End must be after start
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Days off ──────────────────────────────────── */}
      <div>
        <div className="label mb-2 flex items-center gap-1.5">
          <CalendarOff className="h-3.5 w-3.5" /> Days off
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {form.daysOff.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => patch({ daysOff: form.daysOff.filter((d) => d !== key) })}
              title="Remove"
              className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-cream transition-colors hover:border-status-critical/50"
            >
              {formatDayShort(key)}
              <Trash2 className="h-3 w-3 text-[var(--text-faint)]" />
            </button>
          ))}
          <input
            type="date"
            min={dateKeyOf(new Date())}
            onChange={(e) => {
              const key = e.target.value;
              if (key && !form.daysOff.includes(key)) {
                patch({ daysOff: [...form.daysOff, key].sort() });
              }
              e.target.value = "";
            }}
            className={cn(timeCls, "w-40")}
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--text-faint)]">
          Blocks the whole day. Appointments already confirmed for it stay
          cancel those yourself.
        </p>
      </div>

      {/* ── Urgent visits ─────────────────────────────── */}
      <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-espresso p-3">
        <input
          type="checkbox"
          checked={form.acceptsEmergency}
          onChange={(e) => patch({ acceptsEmergency: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[color:var(--accent)]"
        />
        <span>
          <span className="block text-sm font-medium text-cream">
            Take urgent &ldquo;see me now&rdquo; requests
          </span>
          <span className="block text-xs text-[var(--text-faint)]">
            Only ever offered while you&rsquo;re online and not already on a
            consult.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={!dirty || saving}>
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save schedule"}
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setForm(availabilityOf(doctor));
              setDirty(false);
            }}
          >
            Discard
          </Button>
        )}
        {!dirty && !saving && (
          <span className="text-xs text-[var(--text-faint)]">All changes saved</span>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none focus:border-terracotta/60";
const timeCls =
  "rounded-lg border border-[var(--border)] bg-espresso-800 px-2.5 py-1.5 text-sm text-cream outline-none focus:border-terracotta/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
