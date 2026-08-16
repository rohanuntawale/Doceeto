"use client";

/**
 * A standing way into the symptom checker, wherever you are on the page.
 *
 * The checker is the one thing on Doceeto that answers a question before you
 * have an account, and it was reachable only from the nav — which scrolls away
 * on a long landing page, exactly when someone reading about symptoms might
 * want it. This follows the scroll instead.
 *
 * ── Why it opens in place rather than navigating ──
 *
 * It used to be a link to /try/checker. Sending someone to a different page to
 * ask "what's wrong?" throws away everything around them: the section they were
 * reading, their scroll position, and the back button as the only way home. A
 * symptom is a passing thought — it should cost a tap, not a page load. So the
 * checker opens as a panel over the page and closes back to the exact spot they
 * were in.
 *
 * The conversation SURVIVES a close. Once opened the panel stays mounted and is
 * only hidden, so someone who shuts it to re-read a section and comes back finds
 * their answers still there rather than an empty greeting. /try/checker is still
 * a real page — the nav and the footer link to it — and this is the same
 * component, so the two can never drift apart.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { CheckerDemo } from "@/components/try/checker-demo";
import { cn } from "@/lib/utils/cn";

export function CheckerFab() {
  const [open, setOpen] = useState(false);
  /** Mount the checker on FIRST open only — it is never part of the landing
   *  page's initial cost, and it is never thrown away afterwards. */
  const [everOpened, setEverOpened] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    setOpen((v) => {
      if (!v) setEverOpened(true);
      return !v;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      fabRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Press anywhere else to dismiss. The language menu inside the checker is
  // PORTALLED to <body>, so it is not a descendant of the panel — without the
  // second test, choosing Hindi from that menu would close the whole checker.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-language-menu]")) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      // Late enough that it doesn't compete with the hero for the first look.
      transition={{ delay: 1.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7"
    >
      {everOpened && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Symptom check"
          // Sized against the VIEWPORT, not a fixed height: the panel sits above
          // the button and must never run off the top of a short window or a
          // landscape phone. dvh so a mobile browser's collapsing address bar
          // doesn't crop the composer.
          className={cn(
            "w-[min(23.5rem,calc(100vw-2.5rem))] origin-bottom-right",
            "h-[min(34rem,calc(100dvh-9.5rem))]",
            "rounded-card overflow-hidden shadow-[0_24px_60px_-18px_rgb(16_45_35/0.45)]",
            "transition-all duration-200 ease-out",
            open
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none invisible translate-y-2 scale-95 opacity-0",
          )}
          /* Opaque, and inline so it wins.
             `.rounded-card` is globally a FROSTED surface (see globals.css)
             correct for a card sitting on a page, wrong for a panel floating
             over whatever the visitor happens to be scrolled to. Over the
             forest bands and the film, a 70%-translucent chat went muddy and
             the transcript lost contrast. Seating the card on an opaque plate
             keeps the frosted look intact while giving it something calm to be
             frosted against. The inline style is deliberate: that global rule
             is declared after Tailwind's utilities, so a bg-* class here would
             lose to it. */
          style={{ backgroundColor: "rgb(var(--surface-rgb))" }}
        >
          {/* CheckerDemo is h-full by design, it fills whatever slot it is
              given, which is why the same component works as a full page and
              as this panel with no variant of its own. */}
          <CheckerDemo />
        </div>
      )}

      <button
        ref={fabRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="group relative flex items-center gap-2.5 rounded-full bg-[var(--accent)] py-3 pl-3.5 pr-4 text-on-accent shadow-soft-lg transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.5)] focus-visible:ring-offset-2 sm:pr-5"
      >
        {/* One quiet ring, so the button reads as live rather than parked.
            Sits behind the pill and never intercepts the click. It stops once
            the panel is open, the thing it was advertising is on screen. */}
        {!open && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 animate-ping rounded-full bg-[var(--accent)] opacity-20 motion-reduce:animate-none"
          />
        )}
        {open ? (
          <X className="h-4 w-4 shrink-0" />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" />
        )}
        <span className="text-sm font-semibold">
          {open ? (
            "Close"
          ) : (
            <>
              Check a symptom
              {/* The offer is the reason to tap it, so it travels with the
                  label, but quietly, at half a step down. */}
              <span className="ml-1.5 hidden text-xs font-medium opacity-75 sm:inline">
                · free
              </span>
            </>
          )}
        </span>
      </button>
    </motion.div>
  );
}
