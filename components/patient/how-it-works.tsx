"use client";

import { useEffect, useState } from "react";
import { Stethoscope, Siren, Pill, X } from "lucide-react";

const KEY = "iyashi:guide-dismissed:v1";

const STEPS = [
  {
    icon: <Siren className="h-4 w-4" />,
    title: "In an emergency, press SOS",
    desc: "It shares your location so an ambulance and a nearby doctor are alerted.",
  },
  {
    icon: <Stethoscope className="h-4 w-4" />,
    title: "Need a doctor? Find one",
    desc: "See doctors near you on a map. Pick one for a home visit, clinic visit or video call, or let us find your best match.",
  },
  {
    icon: <Pill className="h-4 w-4" />,
    title: "Order medicine",
    desc: "Add what you need and we deliver it to your door.",
  },
];

/** A short, dismissible first-run guide so new users know what to do. */
export function HowItWorks() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!show) return null;

  return (
    <div className="glass rounded-card relative p-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss guide"
        className="absolute right-3 top-3 rounded-lg p-1 text-[var(--text-faint)] transition-colors hover:text-cream"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="label mb-3">How Iyashi works</div>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-terracotta/12 text-salmon ring-1 ring-inset ring-terracotta/20">
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-cream">
                <span className="mr-1.5 font-mono text-xs text-[var(--text-faint)]">
                  {i + 1}
                </span>
                {s.title}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        onClick={dismiss}
        className="mt-3 text-xs font-medium text-salmon hover:underline"
      >
        Got it
      </button>
    </div>
  );
}
