import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

/**
 * Branded 404. Without this, a mistyped or stale URL fell through to Next's
 * unstyled default — a white page with no nav, a total dead end on mobile.
 * Every path off this page is a real surface of the app.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center">
          <Wordmark compact />
        </div>
        <h1 className="mt-10 font-serif text-3xl text-cream">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          The link may be old, or the address was mistyped. Your care is still
          where you left it.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <Link
            href="/patient"
            className="rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            Go to my care
          </Link>
          <Link
            href="/doctor"
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-cream transition-colors hover:bg-espresso-800"
          >
            Doctor dashboard
          </Link>
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
