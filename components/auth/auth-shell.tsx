"use client";

import { useRef } from "react";
import { CareNetwork } from "@/components/auth/care-network";

/**
 * The frame both auth routes sit in: the landing hero's footage, a bordered
 * card over it, and the interactive mark in the right column. Login and signup
 * pass their own left panel as children and share everything else, so the two
 * read as one surface rather than two designs.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid h-screen place-items-center overflow-hidden bg-[rgb(var(--c-forest-paper))] px-3 py-3 text-[var(--text)] sm:px-5 sm:py-4">
      {/* The landing hero's footage, same file and same full-opacity treatment
          as components/landing/landing-hero.tsx. Must be z-0, not -z-10: main
          has z-index:auto, so a negative child escapes to the root stacking
          context and paints behind main's own background. */}
      <video
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover motion-reduce:hidden"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source src="/hero-background.mp4" type="video/mp4" />
      </video>

      {/* The frame carries no fill of its own — the glass lives on the form
          column, so the right column stays a clear window onto the footage. */}
      <div className="relative z-10 grid h-full w-full max-w-5xl overflow-hidden rounded-[22px] border border-white/35 shadow-card lg:grid-cols-[1fr_1fr]">
        {children}
        <FilmPanel />
      </div>
    </main>
  );
}

/**
 * The surface a left panel needs to sit on this shell: glass over the footage,
 * scrolling on its own so a long form never stretches the frame. Both panels
 * apply it so the two columns match edge for edge.
 */
export const authPanelCls =
  "relative flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-[rgb(var(--surface-rgb)/0.85)] px-6 py-8 backdrop-blur-2xl short:py-6 sm:px-10";

function FilmPanel() {
  const bounds = useRef<HTMLDivElement>(null);
  return (
    <section className="relative hidden overflow-hidden lg:block bg-[rgb(236,234,224)/0.10] backdrop-blur-[14px] border-l border-white/40 shadow-soft">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(201, 161, 63, 0.12) 0%, rgba(21, 61, 50, 0.06) 80%)",
        }}
      />

      <div className="absolute inset-y-0 left-0 z-10 w-px bg-white/40" />

      <div ref={bounds} className="absolute inset-0 z-10">
        <CareNetwork boundsRef={bounds} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
        <p className="font-serif text-[14px] italic text-[rgb(21,61,50)]/75 tracking-wide drop-shadow-sm">
          Care that reaches you.
        </p>
      </div>
    </section>
  );
}
