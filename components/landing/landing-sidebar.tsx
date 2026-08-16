"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X, ArrowUpRight, LogIn, UserPlus } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";

export interface SidebarLink {
  id: string;
  label: string;
  href: string;
  /** One line under the label. The header rail had no room for these; a
   *  drawer does, and "Doctors" alone never said what tapping it gets you. */
  hint?: string;
}

/**
 * The landing navigation, as a drawer instead of a header rail.
 *
 * ── Why it moved ──
 *
 * Four uppercase words strung across the header were competing with the two
 * things a visitor actually came to do — get care, or sign in. Behind a single
 * button they stop competing, and each one gets a line of explanation it could
 * never have had inline. It also removes the `hidden md:block` cliff, where the
 * whole rail silently vanished on a phone and those destinations became
 * unreachable from the top of the page.
 *
 * ── Behaviour ──
 *
 * Escape closes it, a press outside closes it, and the page behind is locked
 * while it is open so a scroll gesture over the backdrop does not move the
 * landing page underneath. Focus moves into the panel on open and returns to
 * the trigger on close, so it is usable without a mouse.
 */
export function LandingSidebar({ links }: { links: SidebarLink[] }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock the page while the drawer is open. Without this a scroll over the
  // backdrop moves the landing page behind it, which reads as the drawer
  // having come loose from the page.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keyboard users must land inside the thing that just opened, and be put
  // back where they were when it closes.
  useEffect(() => {
    if (open) {
      const first = panelRef.current?.querySelector<HTMLElement>("a, button");
      first?.focus();
    } else {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const spring = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 420, damping: 40, mass: 0.9 } as const);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        /**
         * Carries its own background rather than inheriting the header's.
         *
         * It first tinted itself light while the header was transparent, on
         * the assumption that meant "over the dark hero". It doesn't — the
         * hero renders a PAPER panel over the forest, so the top of the page
         * is light and a white icon on it was invisible. Rather than track
         * which band is behind it (brittle, and wrong again the next time a
         * section is reordered), the button is opaque: a filled surface, a
         * real border and full-strength foreground text read against anything
         * put behind them.
         */
        className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-soft transition-colors hover:bg-[var(--bg)] hover:text-[var(--accent)]"
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60]"
            initial="closed"
            animate="open"
            exit="closed"
          >
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              className="absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              variants={{
                open: { x: 0 },
                closed: { x: "100%" },
              }}
              transition={spring}
              className="fixed inset-y-0 left-auto right-0 z-10 flex h-[100dvh] w-[min(88vw,340px)] flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <Link href="/" onClick={() => setOpen(false)}>
                  <Wordmark compact />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--text)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-label text-[var(--text-faint)]">
                  What you can get
                </p>
                <ul className="space-y-0.5">
                  {links.map((l, i) => (
                    <motion.li
                      key={l.id}
                      initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      // Staggered so the list assembles rather than appearing
                      // all at once — the drawer is still travelling when the
                      // first item lands.
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { delay: 0.06 + i * 0.045, type: "spring", stiffness: 500, damping: 40 }
                      }
                    >
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--bg)]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium text-[var(--text)]">
                            {l.label}
                          </span>
                          {l.hint && (
                            <span className="mt-0.5 block text-xs leading-snug text-[var(--text-muted)]">
                              {l.hint}
                            </span>
                          )}
                        </span>
                        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-faint)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </nav>

              {/* Account actions, pinned. These are the two things someone
                  opening a menu most often wants, so they never scroll away. */}
              <div className="shrink-0 space-y-2 border-t border-[var(--border)] p-4">
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
                >
                  <UserPlus className="h-4 w-4" />
                  Get started
                </Link>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--bg)]"
                >
                  <LogIn className="h-4 w-4" />
                  Log in
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
