"use client";

import { useEffect, useRef } from "react";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { bmiBand, bmiOf } from "@/lib/health/profile";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

/**
 * Watches the health profile and, when BMI sits outside the healthy range,
 * fetches one AI-written suggestion and surfaces it as a notification.
 *
 * Throttled through localStorage: one nudge per BMI band per week. Nagging
 * someone about their weight on every dashboard visit is how the profile
 * gets deleted, not how habits change. Renders nothing.
 */
const STAMP_KEY = "doceeto:bmi-tip";
const WEEK_MS = 7 * 24 * 3600 * 1000;

export function BmiAdvisor() {
  const { patient } = useCurrentPatient();
  const toast = useToast();
  const asked = useRef(false);

  const p = patient.healthProfile;
  const bmi = p ? bmiOf(p) : undefined;
  const band = bmi !== undefined ? bmiBand(bmi) : undefined;

  useEffect(() => {
    if (!bmi || !band || band === "healthy" || asked.current) return;

    // One nudge per band per week — a changed band (progress!) speaks sooner.
    try {
      const raw = window.localStorage.getItem(STAMP_KEY);
      if (raw) {
        const stamp = JSON.parse(raw) as { band?: string; at?: number };
        if (stamp.band === band && Date.now() - (stamp.at ?? 0) < WEEK_MS) return;
      }
    } catch {
      /* ignore a bad stamp */
    }
    asked.current = true;

    const remember = () => {
      try {
        window.localStorage.setItem(STAMP_KEY, JSON.stringify({ band, at: Date.now() }));
      } catch {
        /* ignore */
      }
    };
    const notify = (tip: string) => {
      toast.push({ tone: "info", title: `Your BMI is ${bmi}, a note for you`, desc: tip });
      remember();
    };

    apiFetch("/api/health-tip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        heightCm: p?.heightCm,
        weightKg: p?.weightKg,
        dob: p?.dob,
        gender: p?.gender,
        conditions: p?.conditions,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.tip) notify(data.tip);
      })
      .catch(() => {
        /* silent — a health tip is never worth an error */
      });
  }, [bmi, band, p, toast]);

  return null;
}
