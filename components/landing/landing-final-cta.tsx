"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  HeartHandshake,
  UserCheck,
  Stethoscope,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingFinalCta() {
  return (
    <section className="relative overflow-hidden bg-espresso-800 text-cream py-28 sm:py-36 border-t-2 border-[var(--border)]">
      {/* Background ambient glow wash */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[rgb(var(--c-terracotta)/0.12)] blur-[160px]" />
        <div className="absolute inset-0 pattern-dots opacity-20" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-tan/30 bg-tan/10 px-4 py-1.5 text-xs font-semibold text-tan mb-6"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>One Door To Care</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-serif text-[clamp(2.5rem,6vw,5.5rem)] font-extrabold tracking-tight text-cream leading-[1.05]"
        >
          Your care journey <br />
          starts <span className="italic text-salmon">here.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-sand font-sans"
        >
          Whether you need treatment or you are ready to offer medical
          expertise, enter through the single door designed for healthcare in
          India.
        </motion.p>

        {/* Triple CTAs (Patient, Doctor, Nurse) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 max-w-2xl mx-auto"
        >
          {/* Patient CTA */}
          <Link href="/signup" className="flex-1">
            <Button
              size="lg"
              className="w-full h-14 px-6 text-base font-semibold shadow-soft group bg-[var(--accent)] text-white hover:brightness-110 border-2 border-transparent transition-all duration-200 hover:-translate-y-0.5"
            >
              <HeartHandshake className="w-5 h-5 mr-2" />
              I need care
              <ArrowRight className="w-4 h-4 ml-auto sm:ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>

          {/* Doctor CTA */}
          <Link href="/signup?as=doctor" className="flex-1">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-14 text-base font-semibold border-2 border-cream/30 text-cream hover:bg-white/10 hover:border-cream"
            >
              <UserCheck className="w-5 h-5 mr-2 text-salmon" />
              I&apos;m a doctor
            </Button>
          </Link>

          {/* Nurse CTA */}
          <Link href="/signup?as=nurse" className="flex-1">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-14 text-base font-semibold border-2 border-[#2F7BC4]/60 text-[#60A5FA] hover:bg-[#2F7BC4]/20 hover:border-[#60A5FA]"
            >
              <Stethoscope className="w-5 h-5 mr-2 text-[#60A5FA]" />
              I&apos;m a nurse
            </Button>
          </Link>
        </motion.div>

        <p className="mt-8 text-xs text-sand/70">
          No credit card required • Instant access to your dashboard • Free
          account creation
        </p>
      </div>
    </section>
  );
}
