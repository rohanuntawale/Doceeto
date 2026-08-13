import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { COMPANY } from "@/lib/legal/company";
import { FOOTER_BAR_LINKS } from "@/lib/legal/documents";
import { FOOTER_SITEMAP } from "@/lib/legal/site-map";

/**
 * The footer carries the site map.
 *
 * It used to be three columns of section anchors — "How it works", "Product
 * Showcase" — which described the landing page rather than the product, and
 * pointed a visitor at nothing they could actually use. The columns now come
 * from lib/legal/site-map.ts, grouped by who is reading, so every link is a
 * real destination and a new page only has to be added in one place.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors">
      <nav
        aria-label="Site map"
        className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      >
        {FOOTER_SITEMAP.map((group) => (
          <div key={group.heading}>
            <h4 className="text-xs font-semibold uppercase tracking-label text-[var(--text-faint)] mb-3">
              {group.heading}
            </h4>
            <ul className="space-y-2.5">
              {group.links.map((l) => (
                <li key={`${group.heading}-${l.label}`}>
                  <Link
                    href={l.href}
                    className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Brand sits under the map, the way a masthead closes a page. */}
      <div className="mx-auto max-w-6xl px-6 pb-12">
        <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Wordmark compact={false} />
            {/* No em-dash: 5ccdfc2 stripped the dashes from the landing copy.
                That commit edited this sentence where it used to live, in the
                brand column above the links; this branch had already moved it
                below the site map, so the change is carried across by hand. */}
            <p className="max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
              Connecting patient needs with doctor expertise India&apos;s single
              front door to care.
            </p>
          </div>
          {/* The one line worth repeating on every page of a healthcare site. */}
          <p className="max-w-xs text-xs leading-relaxed text-[var(--text-faint)] sm:text-right">
            Not for emergencies. Call{" "}
            <span className="font-semibold text-[var(--text-muted)]">112</span>{" "}
            or{" "}
            <span className="font-semibold text-[var(--text-muted)]">108</span>{" "}
            if life is at risk.
          </p>
        </div>
      </div>

      {/* Bottom bar: copyright, then the condensed legal strip. */}
      <div className="border-t border-[var(--border)] py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-xs text-[var(--text-faint)] md:flex-row md:justify-between">
          <p className="order-2 text-center md:order-1 md:text-left">
            © {new Date().getFullYear()} {COMPANY.legalName}. All rights
            reserved.
          </p>
          <nav
            aria-label="Legal"
            className="order-1 flex flex-wrap items-center justify-center gap-y-2 md:order-2 md:justify-end"
          >
            {FOOTER_BAR_LINKS.map((l, i) => (
              <span key={l.href} className="flex items-center">
                {i > 0 ? (
                  <span aria-hidden className="px-2 opacity-50">
                    |
                  </span>
                ) : null}
                <Link
                  href={l.href}
                  className="whitespace-nowrap transition-colors hover:text-terracotta"
                >
                  {l.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
