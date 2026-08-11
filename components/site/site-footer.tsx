import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "For Patients", href: "#patient-doctor" },
      { label: "For Doctors", href: "#patient-doctor" },
      { label: "Product Showcase", href: "#showcase" },
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
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
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

      {/* Bottom bar */}
      <div className="border-t border-[var(--border)] py-5 text-center text-xs text-[var(--text-faint)]">
        © {new Date().getFullYear()} Doceeto Health Pvt. Ltd. All rights reserved.
      </div>
    </footer>
  );
}
