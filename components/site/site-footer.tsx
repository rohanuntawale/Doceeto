import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { COMPANY } from "@/lib/legal/company";
import { FOOTER_BAR_LINKS } from "@/lib/legal/documents";

const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      // Rooted at "/" deliberately. The footer renders on every page, so a bare
      // "#how-it-works" resolves against the *current* path — from a legal page
      // it becomes /legal/privacy#how-it-works, an anchor to nothing.
      { label: "How it works", href: "/#how-it-works" },
      { label: "For Patients", href: "/#patient-doctor" },
      { label: "For Doctors", href: "/#patient-doctor" },
      { label: "Product Showcase", href: "/#showcase" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Sign in / Register", href: "/login?tab=signup" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Use", href: "/legal/terms" },
      { label: "Medical Disclaimer", href: "/legal/medical-disclaimer" },
      { label: "Grievance Redressal", href: "/legal/grievance" },
      { label: "All policies", href: "/legal" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors">
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand column */}
        <div className="space-y-4">
          <Wordmark compact={false} />
          <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xs">
            Connecting patient needs with doctor expertise — India&apos;s single front door to care.
          </p>
          {/* The one line worth repeating on every page of a healthcare site. */}
          <p className="max-w-xs text-xs leading-relaxed text-[var(--text-faint)]">
            Not for emergencies. Call{" "}
            <span className="font-semibold text-[var(--text-muted)]">112</span> or{" "}
            <span className="font-semibold text-[var(--text-muted)]">108</span> if
            life is at risk.
          </p>
        </div>

        {/* Link columns */}
        {FOOTER_LINKS.map((group) => (
          <div key={group.heading}>
            <h4 className="text-xs font-semibold uppercase tracking-label text-[var(--text-faint)] mb-3">
              {group.heading}
            </h4>
            <ul className="space-y-2.5">
              {group.links.map((l) => (
                <li key={l.label}>
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
      </div>

      {/* Bottom bar: copyright, then the condensed legal strip. */}
      <div className="border-t border-[var(--border)] py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-xs text-[var(--text-faint)] md:flex-row md:justify-between">
          <p className="order-2 text-center md:order-1 md:text-left">
            © {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.
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
