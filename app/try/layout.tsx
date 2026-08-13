import Link from "next/link";
import { Home } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { PreviewTabs } from "@/components/try/preview-chrome";

/**
 * /try — what the product does, without an account.
 *
 * PUBLIC BY CONSTRUCTION. These routes live outside /patient on purpose: the
 * middleware turns an anonymous visitor away from every /patient/* path, which
 * is right for a dashboard and wrong for a shop window. Keeping the previews on
 * their own prefix means the auth rule stays simple and nothing here is one
 * config edit away from leaking a real patient screen.
 *
 * They read from /api/public, which returns a hand-built projection with no
 * coordinates and no contact details — see the note there.
 */
/**
 * ── Why this layout owns the viewport height ──
 *
 * These screens are meant to be used, not read top-to-bottom, and the checker
 * in particular is a conversation: a composer that drifts below the fold is a
 * composer you have to hunt for after every reply.
 *
 * So the page itself never scrolls. `100dvh` (dynamic, not `vh`) is the whole
 * budget — on mobile that tracks the browser chrome as it collapses, where
 * plain `vh` would leave the input hidden behind Safari's toolbar. Header,
 * tabs and the home button take their natural height; `flex-1 min-h-0` hands
 * every remaining pixel to the page, and scrolling happens INSIDE it.
 *
 * `min-h-0` is the load-bearing part: a flex child defaults to min-height:auto,
 * which refuses to shrink below its content and pushes the overflow back out to
 * the page — the exact bug this is preventing.
 */
export default function TryLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden">
      <div className="shrink-0">
        <SiteHeader />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-5 py-4 md:px-8 md:py-5">
        <div className="shrink-0">
          <PreviewTabs />
        </div>

        {/* The page. Lists scroll in here; the checker fills it exactly and
            scrolls its own transcript instead. */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>

        {/* No site footer on purpose. These are focused, single-task screens —
            someone mid-way through describing a symptom does not need About /
            Careers / Legal underneath them. One way back out is enough. */}
        <div className="mt-3 flex shrink-0 justify-center border-t border-[var(--border)] pt-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Home className="h-4 w-4" />
            Go to home page
          </Link>
        </div>
      </div>
    </main>
  );
}
