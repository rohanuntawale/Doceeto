"use client";

/**
 * A standing way into the symptom checker, wherever you are on the page.
 *
 * The checker is the one thing on Doceeto that answers a question before you
 * have an account, and it was reachable only from the nav — which scrolls away
 * on a long landing page, exactly when someone reading about symptoms might
 * want it. This follows the scroll instead.
 *
 * It points at /try/checker rather than /patient/care: the preview gives two
 * free checks without a sign-in, and sending someone with a symptom to a login
 * form is how you lose them.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function CheckerFab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      // Late enough that it doesn't compete with the hero for the first look.
      transition={{ delay: 1.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-5 right-5 z-40 sm:bottom-7 sm:right-7"
    >
      <Link
        href="/try/checker"
        className="group relative flex items-center gap-2.5 rounded-full bg-[var(--accent)] py-3 pl-3.5 pr-4 text-on-accent shadow-soft-lg transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.5)] focus-visible:ring-offset-2 sm:pr-5"
      >
        {/* One quiet ring, so the button reads as live rather than parked.
            Sits behind the pill and never intercepts the click. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 animate-ping rounded-full bg-[var(--accent)] opacity-20 motion-reduce:animate-none"
        />
        <Sparkles className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">
          Check a symptom
          {/* The offer is the reason to tap it, so it travels with the label —
              but quietly, at half a step down. */}
          <span className="ml-1.5 hidden text-xs font-medium opacity-75 sm:inline">
            · free
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
