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
export default function TryLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12">
        <PreviewTabs />
        <div className="mt-6">{children}</div>

        {/* No site footer here on purpose. These are focused, single-task
            screens — someone mid-way through describing a symptom does not
            need About / Careers / Legal underneath them. One way back out is
            enough. */}
        <div className="mt-10 flex justify-center border-t border-[var(--border)] pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Home className="h-4 w-4" />
            Go to home page
          </Link>
        </div>
      </div>
    </main>
  );
}
