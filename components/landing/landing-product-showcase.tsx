"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import {
  HeartHandshake,
  UserCheck,
  Stethoscope,
  Clock,
  ShieldCheck,
  Check,
  Pill,
  MapPin,
} from "lucide-react";

export function LandingProductShowcase() {
  const [activeTab, setActiveTab] = useState<"patient" | "doctor" | "nurse">(
    "patient",
  );

  return (
    <section id="showcase" className="py-28 sm:py-36 bg-[var(--bg)]">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="label border-b-2 border-[var(--accent)] pb-1 text-xs tracking-[0.2em] inline-block mb-3">
            04 / PRODUCT EXPERIENCE
          </span>
          <h2 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-[var(--text)]">
            Built for clarity, speed, and trusted care.
          </h2>
          <p className="mt-4 text-lg text-[var(--text-muted)] leading-relaxed">
            Explore the specialized interfaces designed for each participant in
            the care ecosystem.
          </p>
        </div>

        {/* Tab Switcher Buttons */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <button
            onClick={() => setActiveTab("patient")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === "patient"
                ? "bg-[var(--accent)] text-[var(--c-on-accent)] shadow-md scale-105"
                : "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)]"
            }`}
          >
            <HeartHandshake className="w-4 h-4" /> Patient View
          </button>

          <button
            onClick={() => setActiveTab("doctor")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === "doctor"
                ? "bg-[var(--accent)] text-[var(--c-on-accent)] shadow-md scale-105"
                : "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)]"
            }`}
          >
            <UserCheck className="w-4 h-4" /> Doctor View
          </button>

          <button
            onClick={() => setActiveTab("nurse")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === "nurse"
                ? "bg-[#2F7BC4] text-white shadow-md scale-105"
                : "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)]"
            }`}
          >
            <Stethoscope className="w-4 h-4" /> Nurse View
          </button>
        </div>

        {/* Mockup Browser Window Container */}
        <div className="relative mx-auto max-w-5xl">
          <GlassCard className="p-6 sm:p-8 border-2 border-[var(--border)] shadow-card">
            {/* Mockup Browser Chrome Top Bar */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <span className="h-3 w-3 rounded-full bg-green-500/70" />
                <span className="ml-4 font-mono text-xs text-[var(--text-faint)] hidden sm:inline">
                  doceeto.health/app/{activeTab}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-status-ok font-semibold">
                <ShieldCheck className="w-4 h-4" /> Secure Surface
              </span>
            </div>

            {/* Tab 1: Patient View Mockup */}
            {activeTab === "patient" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[var(--text)]">
                      Patient Care Hub
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Active care requests and upcoming appointments
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--accent)]/15 text-[var(--accent)] px-3 py-1 text-xs font-bold border border-[var(--accent)]/30">
                    Live Status: Ready for booking
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Care Card 1 */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--accent)]">
                        General Consultation
                      </span>
                      <span className="font-mono font-bold text-cream">
                        ₹499
                      </span>
                    </div>
                    <h4 className="font-semibold text-lg text-[var(--text)]">
                      Dr. Rajesh Varma, MD
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-tan" /> Laxminagar,
                      Nagpur (2.4 km away)
                    </p>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-status-ok font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Next slot: 3:30 PM
                        Today
                      </span>
                      <span className="text-xs font-semibold text-[var(--accent)] underline">
                        View Profile →
                      </span>
                    </div>
                  </div>

                  {/* Care Card 2 */}
                  <div className="rounded-2xl border border-[#2F7BC4]/30 bg-[#2F7BC4]/5 p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span className="font-semibold text-[#2F7BC4]">
                        Home Nurse Visit
                      </span>
                      <span className="font-mono font-bold text-cream">
                        ₹350
                      </span>
                    </div>
                    <h4 className="font-semibold text-lg text-[var(--text)]">
                      Sister Meera Nair, B.Sc Nursing
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-[#2F7BC4]" />{" "}
                      Post-op dressing &amp; IV assistance
                    </p>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-[#2F7BC4] font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Verified Home Nurse
                      </span>
                      <span className="text-xs font-semibold text-[#2F7BC4] underline">
                        Book Nurse →
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 2: Doctor View Mockup */}
            {activeTab === "doctor" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[var(--text)]">
                      Doctor Cockpit
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Incoming patient requests and practice schedule
                    </p>
                  </div>
                  <span className="rounded-full bg-status-ok/15 text-status-ok px-3 py-1 text-xs font-bold border border-status-ok/30">
                    Accepting New Consultations
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Doctor Card 1 */}
                  <div className="rounded-2xl border-2 border-[var(--accent)]/40 bg-[var(--bg)] p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--accent)] uppercase tracking-wider text-[10px]">
                        New Incoming Request
                      </span>
                      <span className="font-mono text-[var(--text-faint)]">
                        #REQ-8821
                      </span>
                    </div>
                    <h4 className="font-semibold text-lg text-[var(--text)]">
                      Patient: Ramesh K. (Age 58)
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      Symptoms: High blood pressure readings &amp; mild
                      dizziness. Requesting evening home call or tele-consult.
                    </p>
                    <div className="pt-3 flex gap-2">
                      <span className="rounded-lg bg-[var(--accent)] text-[var(--c-on-accent)] px-3 py-1.5 text-xs font-bold">
                        Accept Request
                      </span>
                      <span className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                        Reschedule
                      </span>
                    </div>
                  </div>

                  {/* Doctor Card 2 */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span className="font-semibold text-tan flex items-center gap-1">
                        <Pill className="w-3.5 h-3.5" /> Rx Generator
                      </span>
                      <span>Digital Sign Off</span>
                    </div>
                    <h4 className="font-semibold text-base text-[var(--text)]">
                      Quick Prescription Builder
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      Issue verified digital prescriptions directly to patient
                      profiles with single-click authorization.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 3: Nurse View Mockup */}
            {activeTab === "nurse" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[var(--text)]">
                      Home Nurse Console
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Home care visits and duty log
                    </p>
                  </div>
                  <span className="rounded-full bg-[#2F7BC4]/15 text-[#2F7BC4] px-3 py-1 text-xs font-bold border border-[#2F7BC4]/30">
                    Duty Status: Active
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Nurse Duty Card 1 */}
                  <div className="rounded-2xl border-2 border-[#2F7BC4]/40 bg-[#2F7BC4]/5 p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#2F7BC4] uppercase tracking-wider text-[10px]">
                        Confirmed Visit
                      </span>
                      <span className="font-mono text-[var(--text-faint)]">
                        Today • 4:00 PM
                      </span>
                    </div>
                    <h4 className="font-semibold text-lg text-[var(--text)]">
                      Post-Surgical Dressing Change
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      Location: Manewada, Nagpur (1.8 km). Patient needs wound
                      cleaning, sterile dressing, and BP check.
                    </p>
                    <div className="pt-2">
                      <span className="rounded-lg bg-[#2F7BC4] text-white px-3 py-1.5 text-xs font-bold">
                        Start Route Map →
                      </span>
                    </div>
                  </div>

                  {/* Nurse Duty Card 2 */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span className="font-semibold text-status-ok">
                        Available Care Requests
                      </span>
                      <span className="font-mono">Near You</span>
                    </div>
                    <h4 className="font-semibold text-base text-[var(--text)]">
                      Elderly Vitals Check &amp; Injection
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      Daily insulin administration &amp; routine vitals log.
                      Open for home nurses nearby.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
