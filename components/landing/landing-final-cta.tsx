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
    /* The page closes on the same forest green it opened under, curving up
       out of the paper one last time. */
    <section className="relative bg-[var(--bg)]">
      <div className="forest-band relative overflow-hidden rounded-t-[2rem] sm:rounded-t-[3rem] lg:rounded-t-[4.5rem] py-28 sm:py-36">
        {/* Background ambient glow wash */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[rgb(var(--c-forest-600)/0.6)] blur-[160px]" />
          <div className="absolute inset-0 pattern-dots opacity-[0.07]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-tan/40 bg-tan/10 px-4 py-1.5 text-xs font-semibold text-tan mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>One Door To Care</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-serif text-[clamp(2.5rem,6vw,5.5rem)] font-extrabold tracking-tight text-[var(--text)] leading-[1.05]"
          >
            Your care journey <br />
            starts <span className="italic text-mint">here.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--text-muted)] font-sans"
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
            {/* Patient CTA — bone on green; the accent inverts on this band */}
            <Link href="/signup" className="flex-1">
              <Button
                size="lg"
                className="w-full h-14 px-6 text-base font-semibold shadow-soft group bg-paper text-forest hover:brightness-105 border-2 border-transparent transition-all duration-200 hover:-translate-y-0.5"
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
                className="w-full h-14 text-base font-semibold border-2 border-paper/30 text-[var(--text)] hover:bg-paper/10 hover:border-paper/60"
              >
                <UserCheck className="w-5 h-5 mr-2 text-mint" />
                I&apos;m a doctor
              </Button>
            </Link>

            {/* Nurse CTA */}
            <Link href="/signup?as=nurse" className="flex-1">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-14 text-base font-semibold border-2 border-[#2F7BC4]/60 text-[#7FB7F0] hover:bg-[#2F7BC4]/20 hover:border-[#7FB7F0]"
              >
                <Stethoscope className="w-5 h-5 mr-2 text-[#7FB7F0]" />
                I&apos;m a nurse
              </Button>
            </Link>
          </motion.div>

          <p className="mt-8 text-xs text-[var(--text-faint)]">
            No credit card required • Instant access to your dashboard • Free
            account creation
          </p>
        </div>
      </div>
    </section>
  );
}
