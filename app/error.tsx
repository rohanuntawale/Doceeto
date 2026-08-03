"use client";

import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

/**
 * Branded runtime-error boundary. Pairs with app/not-found.tsx: a crash used
 * to strand the user on Next's default screen with no way back in.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center">
          <Wordmark compact />
        </div>
        <h1 className="mt-10 font-serif text-3xl text-cream">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          The page hit an error it couldn&apos;t recover from. Trying again
          usually fixes it.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <button
            onClick={reset}
            className="rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="mt-2 text-sm text-[var(--text-muted)] transition-colors hover:text-cream"
          >
            Doceeto home
          </Link>
        </div>
      </div>
    </main>
  );
}
