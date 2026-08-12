import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Printer, Mail, ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import {
  COMPANY,
  CONTACTS,
  POLICY_VERSION,
  formatLegalDate,
} from "@/lib/legal/company";
import { docBySlug, LEGAL_DOCS, legalHref } from "@/lib/legal/documents";

/**
 * One section of a policy. Declaring sections as DATA rather than as free-form
 * JSX headings is what keeps the table of contents honest: the sidebar and the
 * body are rendered from the same array, so a section can never be added to one
 * and forgotten in the other, and every heading is guaranteed to have the
 * anchor its TOC entry links to.
 */
export interface LegalSection {
  /** URL fragment. Stable — external sites and our own cross-links cite these. */
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * Shared chrome for every legal document: breadcrumb, title block with the
 * version stamp, a sticky contents rail on desktop, auto-numbered sections, and
 * the contact + sibling-document footer.
 *
 * Sections are numbered by position rather than hard-coded, so inserting a
 * clause never means renumbering the ones below it. Prose therefore
 * cross-references sections by LINK (`#retention`), never by number.
 */
export function LegalDocument({
  slug,
  sections,
  intro,
  /** Overrides the registry summary in the lead paragraph, when a document
   *  needs a longer opening than its one-line hub blurb. */
  lead,
}: {
  slug: string;
  sections: LegalSection[];
  intro?: ReactNode;
  lead?: ReactNode;
}) {
  const doc = docBySlug(slug);
  const title = doc?.title ?? "Legal";
  const siblings = LEGAL_DOCS.filter((d) => d.slug !== slug).slice(0, 6);

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 md:px-8 md:pb-24 md:pt-12">
        <Breadcrumb title={title} />

        {/* Title block */}
        <header className="mt-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-terracotta" />
            <span className="label">Legal</span>
          </div>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-cream md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[var(--text-muted)]">
            {lead ?? doc?.summary}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
            <Stamp label="Version" value={POLICY_VERSION.version} />
            <Stamp
              label="Effective"
              value={formatLegalDate(POLICY_VERSION.effectiveDate)}
            />
            <Stamp
              label="Last updated"
              value={formatLegalDate(POLICY_VERSION.lastUpdated)}
            />
          </div>
        </header>

        {intro ? <div className="mt-8 max-w-3xl">{intro}</div> : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
          <Contents sections={sections} />

          <article className="min-w-0 max-w-3xl">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                // Clearance for the sticky header comes from scroll-padding-top
                // on <html> (globals.css), so no scroll-mt here — the two would
                // stack and drop the heading a full extra header below the fold.
                className="border-t border-[var(--border)] pt-8 first:border-t-0 first:pt-0 [&+section]:mt-10"
              >
                <h2 className="font-serif text-2xl leading-snug text-cream md:text-[1.75rem]">
                  <span className="mr-2.5 font-sans text-sm font-semibold tabular-nums text-terracotta">
                    {i + 1}
                  </span>
                  {s.title}
                </h2>
                <div className="mt-4 space-y-4">{s.content}</div>
              </section>
            ))}

            <DocumentFooter slug={slug} siblings={siblings} />
          </article>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb" className="print:hidden">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-faint)]">
        <li>
          <Link href="/" className="transition-colors hover:text-terracotta">
            Home
          </Link>
        </li>
        <ChevronRight aria-hidden className="h-3 w-3" />
        <li>
          <Link href="/legal" className="transition-colors hover:text-terracotta">
            Legal
          </Link>
        </li>
        <ChevronRight aria-hidden className="h-3 w-3" />
        <li aria-current="page" className="text-[var(--text-muted)]">
          {title}
        </li>
      </ol>
    </nav>
  );
}

function Stamp({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-espresso-800 px-3 py-1.5">
      <span className="uppercase tracking-label text-[10px] text-[var(--text-faint)]">
        {label}
      </span>
      <span className="font-medium text-[var(--text-muted)]">{value}</span>
    </span>
  );
}

/** Sticky contents rail. Hidden on mobile, where it would push the document
 *  a full screen down before a single word of it is visible. */
function Contents({ sections }: { sections: LegalSection[] }) {
  return (
    <aside className="hidden lg:block print:hidden">
      <nav
        aria-label="On this page"
        className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2"
      >
        <div className="label mb-3">On this page</div>
        <ol className="space-y-1.5">
          {sections.map((s, i) => (
            <li key={s.id} className="flex gap-2 text-[13px] leading-snug">
              <span className="shrink-0 tabular-nums text-[var(--text-faint)]">
                {i + 1}.
              </span>
              <a
                href={`#${s.id}`}
                className="text-[var(--text-muted)] transition-colors hover:text-terracotta"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}

function DocumentFooter({
  slug,
  siblings,
}: {
  slug: string;
  siblings: { slug: string; title: string }[];
}) {
  return (
    <footer className="mt-14 border-t border-[var(--border)] pt-8">
      <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-6 shadow-card">
        <h2 className="font-serif text-xl text-cream">Questions about this page?</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Write to us and a person will answer — these documents are meant to be
          readable, and if something here is unclear that is a fault worth
          fixing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`mailto:${CONTACTS.legal}?subject=${encodeURIComponent(
              `Question about the ${slug} page`,
            )}`}
            className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-terracotta-700"
          >
            <Mail className="h-3.5 w-3.5" /> {CONTACTS.legal}
          </a>
          <Link
            href="/legal/grievance"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-terracotta/40 hover:text-terracotta"
          >
            Raise a formal grievance <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <div className="label mb-3">Related documents</div>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {siblings.map((s) => (
            <li key={s.slug}>
              <Link
                href={legalHref(s.slug)}
                className="text-sm text-[var(--text-muted)] transition-colors hover:text-terracotta"
              >
                {s.title}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/legal"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
        >
          See all legal documents <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-[var(--text-faint)]">
        <Printer aria-hidden className="h-3.5 w-3.5" />
        {COMPANY.legalName} · {titleOf(slug)} · version {POLICY_VERSION.version},
        effective {formatLegalDate(POLICY_VERSION.effectiveDate)}
      </p>
    </footer>
  );
}

const titleOf = (slug: string) => docBySlug(slug)?.title ?? "Legal";
