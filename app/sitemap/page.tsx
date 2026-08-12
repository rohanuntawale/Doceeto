import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { COMPANY } from "@/lib/legal/company";
import {
  SITE_SECTIONS,
  LEGAL_SECTION_META,
  type SiteEntry,
} from "@/lib/legal/site-map";
import { LEGAL_DOCS, legalHref } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: `Site Map · ${COMPANY.brand}`,
  description: `Every page on ${COMPANY.brand}, in one list — patient, doctor, nurse and legal.`,
  alternates: { canonical: "/sitemap" },
};

/** The legal documents, folded in as a final section built from the registry
 *  so a new policy appears here the moment it is published. */
const legalEntries: SiteEntry[] = LEGAL_DOCS.map((d) => ({
  href: legalHref(d.slug),
  label: d.title,
  description: d.summary,
}));

export default function SiteMapPage() {
  const sections = [
    ...SITE_SECTIONS,
    {
      ...LEGAL_SECTION_META,
      entries: [
        {
          href: "/legal",
          label: "Legal hub",
          description: "All policies, grouped and summarised.",
        },
        ...legalEntries,
      ],
    },
  ];

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-5 pb-20 pt-10 md:px-8 md:pb-28 md:pt-14">
        <header className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-terracotta" />
            <span className="label">Site Map</span>
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-tight text-cream md:text-6xl">
            Every page, <span className="text-salmon">one list.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
            {COMPANY.brand} has four surfaces — patient, doctor, nurse and
            operations — plus the public site. Pages marked with a lock need you
            to be signed in with that kind of account.
          </p>
          <p className="mt-4 text-xs text-[var(--text-faint)]">
            Machine-readable version:{" "}
            <a
              href="/sitemap.xml"
              className="text-terracotta underline decoration-terracotta/30 underline-offset-2 hover:decoration-terracotta"
            >
              /sitemap.xml
            </a>
          </p>
        </header>

        <div className="mt-12 space-y-12">
          {sections.map((section) => (
            <section key={section.id} id={section.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[var(--border)] pb-3">
                <h2 className="font-serif text-2xl text-cream">
                  {section.title}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {section.blurb}
                </p>
              </div>
              <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {section.entries.map((e) => (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-cream transition-colors hover:text-terracotta"
                    >
                      {e.label}
                      {e.requires ? (
                        <Lock
                          aria-hidden
                          className="h-3 w-3 shrink-0 text-[var(--text-faint)]"
                        />
                      ) : null}
                    </Link>
                    {e.requires ? (
                      <span className="ml-1.5 align-middle text-[10px] uppercase tracking-label text-[var(--text-faint)]">
                        {e.requires}
                      </span>
                    ) : null}
                    {e.description ? (
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                        {e.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
