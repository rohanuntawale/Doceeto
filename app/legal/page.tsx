import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { KeyValues, Address, MailLink } from "@/components/legal/prose";
import {
  COMPANY,
  CONTACTS,
  OFFICERS,
  POLICY_VERSION,
  formatLegalDate,
  correspondenceAddress,
} from "@/lib/legal/company";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  docsInCategory,
  legalHref,
  type LegalDoc,
} from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: `Legal · ${COMPANY.brand}`,
  description: `Every ${COMPANY.brand} policy in one place, privacy, terms, medical disclaimers, sales, provider terms, grievance redressal and data deletion.`,
  alternates: { canonical: "/legal" },
};

export default function LegalHubPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-5 pb-20 pt-10 md:px-8 md:pb-28 md:pt-14">
        {/* Hero */}
        <header className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-terracotta" />
            <span className="label">Legal</span>
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-tight text-cream md:text-6xl">
            Everything we owe you, <span className="text-salmon">in writing.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
            Healthcare runs on trust, and trust is easier to give when the terms
            are legible. These documents are written to be read by the people
            they bind, not to be scrolled past.
          </p>
          <p className="mt-4 text-xs text-[var(--text-faint)]">
            All documents at version {POLICY_VERSION.version}, effective{" "}
            {formatLegalDate(POLICY_VERSION.effectiveDate)}.
          </p>
        </header>

        {/* Emergency banner, the one thing worth interrupting for. */}
        <div className="mt-10 flex gap-3 rounded-card border border-status-critical/35 bg-status-critical/[0.07] p-5">
          <ShieldAlert
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-status-critical"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-cream">
              In an emergency, call 112 or 108
            </div>
            <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--text-muted)]">
              {COMPANY.brand} is not an emergency service and the SOS button does
              not dial one.{" "}
              <Link
                href="/legal/emergency"
                className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2 hover:decoration-terracotta"
              >
                Read the limits before you need them
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Documents by category */}
        {CATEGORY_ORDER.map((cat) => {
          const docs = docsInCategory(cat);
          if (docs.length === 0) return null;
          const meta = CATEGORY_META[cat];
          return (
            <section key={cat} className="mt-14">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[var(--border)] pb-3">
                <h2 className="font-serif text-2xl text-cream">{meta.label}</h2>
                <p className="text-sm text-[var(--text-muted)]">{meta.blurb}</p>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {docs.map((d) => (
                  <DocCard key={d.slug} doc={d} />
                ))}
              </ul>
            </section>
          );
        })}

        {/* Entity + officers */}
        <section className="mt-16 border-t border-[var(--border)] pt-12">
          <h2 className="font-serif text-2xl text-cream">Who you are dealing with</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <div className="label">The company</div>
              <KeyValues
                items={[
                  { label: "Entity", value: COMPANY.legalName },
                  { label: "CIN", value: COMPANY.cin },
                  { label: "GSTIN", value: COMPANY.gstin },
                  {
                    label: "Address",
                    value: <Address lines={correspondenceAddress()} />,
                  },
                ]}
              />
            </div>
            <div className="space-y-3">
              <div className="label">Who to write to</div>
              <KeyValues
                items={[
                  {
                    label: "General",
                    value: <MailLink address={CONTACTS.general} />,
                  },
                  {
                    label: "Support",
                    value: <MailLink address={CONTACTS.support} />,
                  },
                  {
                    label: OFFICERS.dataProtection.role,
                    value: <MailLink address={OFFICERS.dataProtection.email} />,
                  },
                  {
                    label: OFFICERS.grievance.role,
                    value: <MailLink address={OFFICERS.grievance.email} />,
                  },
                  {
                    label: "Clinical concerns",
                    value: <MailLink address={CONTACTS.medical} />,
                  },
                  {
                    label: "Security",
                    value: <MailLink address={CONTACTS.security} />,
                  },
                ]}
              />
            </div>
          </div>
        </section>

        <p className="mt-10 text-sm text-[var(--text-muted)]">
          Looking for a page rather than a policy? Try the{" "}
          <Link
            href="/sitemap"
            className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2 hover:decoration-terracotta"
          >
            site map
          </Link>
          .
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}

function DocCard({ doc }: { doc: LegalDoc }) {
  return (
    <li>
      <Link
        href={legalHref(doc.slug)}
        className="group flex h-full flex-col rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card transition-colors hover:border-terracotta/40"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg leading-snug text-cream">
            {doc.title}
          </h3>
          <ArrowRight
            aria-hidden
            className="mt-1 h-4 w-4 shrink-0 text-[var(--text-faint)] transition-all group-hover:translate-x-0.5 group-hover:text-terracotta"
          />
        </div>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--text-muted)]">
          {doc.summary}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] uppercase tracking-label text-[var(--text-faint)]">
            {doc.audience}
          </span>
          {doc.storeRequired ? (
            <span className="rounded-full border border-terracotta/30 bg-terracotta/10 px-2.5 py-1 text-[10px] uppercase tracking-label text-terracotta">
              App store required
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
