"use client";

import { Stethoscope, RefreshCw } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

const EASE: [number, number, number, number] = [0.43, 0.13, 0.23, 0.96];

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: EASE,
      delayChildren: 0.1,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
};

const numberVariants: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: direction * 40,
    y: 15,
    rotate: direction * 5,
  }),
  visible: {
    opacity: 0.7,
    x: 0,
    y: 0,
    rotate: 0,
    transition: { duration: 0.8, ease: EASE },
  },
};

const iconVariants: Variants = {
  hidden: { scale: 0.8, opacity: 0, y: 15, rotate: -5 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 0.6, ease: EASE },
  },
  floating: {
    y: [-5, 5],
    transition: {
      y: {
        duration: 2,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "reverse" as const,
      },
    },
  },
};

/**
 * Full-screen "the website is down" page (503), shown by SiteDownGate only
 * while the server is unreachable — never rendered during normal operation.
 */
export function SiteDown({
  onRetry,
  checking = false,
}: {
  onRetry?: () => void;
  checking?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <AnimatePresence mode="wait">
        <motion.div
          className="text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <div className="mb-8 flex items-center justify-center gap-4 md:mb-12 md:gap-6">
            <motion.span
              className="select-none font-serif text-[80px] font-bold text-cream opacity-70 md:text-[120px]"
              variants={numberVariants}
              custom={-1}
            >
              5
            </motion.span>
            <motion.div
              variants={iconVariants}
              animate={["visible", "floating"]}
              className="text-terracotta"
            >
              <Stethoscope
                className="h-[80px] w-[80px] select-none md:h-[120px] md:w-[120px]"
                strokeWidth={1.5}
                aria-hidden
              />
            </motion.div>
            <motion.span
              className="select-none font-serif text-[80px] font-bold text-cream opacity-70 md:text-[120px]"
              variants={numberVariants}
              custom={1}
            >
              3
            </motion.span>
          </div>

          <motion.h1
            className="mb-4 select-none font-serif text-3xl font-bold text-cream opacity-90 md:mb-6 md:text-5xl"
            variants={itemVariants}
          >
            The website is down
          </motion.h1>

          <motion.p
            className="mb-8 select-none text-lg text-[var(--text-muted)] md:mb-12 md:text-xl"
            variants={itemVariants}
          >
            We can&apos;t reach the server right now. We&apos;ll keep checking
            and bring you back the moment it recovers.
          </motion.p>

          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.05, transition: { duration: 0.3, ease: EASE } }}
          >
            <button
              onClick={onRetry}
              disabled={checking}
              className="inline-flex select-none items-center gap-2 rounded-full bg-terracotta px-8 py-3 text-lg font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${checking ? "animate-spin" : ""}`}
                aria-hidden
              />
              {checking ? "Checking…" : "Try again"}
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
