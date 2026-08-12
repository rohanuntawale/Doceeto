import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
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
      </div>
      <SiteFooter />
    </main>
  );
}
