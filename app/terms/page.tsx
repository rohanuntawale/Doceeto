import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = {
  title: "Terms of Service · Doceeto Health",
  description:
    "Terms and conditions for using Doceeto healthcare platform services.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="space-y-6">
          <div className="border-b border-[var(--border)] pb-6">
            <span className="label">Legal</span>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Last updated: August 2026
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-[var(--text-muted)] leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing and using the Doceeto platform
                (&quot;Service&quot;), including our mobile and web
                applications, you agree to be bound by these Terms of Service.
                If you do not agree with any part of these terms, you may not
                use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                2. Medical Disclaimer & Service Role
              </h2>
              <p>
                Doceeto is a technology platform connecting healthcare seekers
                (&quot;Patients&quot;) with licensed medical professionals
                (&quot;Doctors&quot; and &quot;Nurses&quot;). Doceeto itself
                does not provide medical treatment or medical advice directly.
                All medical care is provided independently by certified
                healthcare providers on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                3. User Accounts & Responsibilities
              </h2>
              <p>
                You must provide accurate, complete, and current information
                when registering on Doceeto. Healthcare providers must maintain
                active, valid medical licenses and registration with relevant
                statutory councils (e.g., State Medical Council / NMC).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                4. Appointments & Emergency Care
              </h2>
              <p>
                For immediate life-threatening medical emergencies, users should
                call standard emergency lines immediately. While Doceeto offers
                urgent care booking, platform availability is subject to network
                connectivity and local doctor availability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                5. Fees & Payments
              </h2>
              <p>
                Consultation and home visit fees are determined clearly prior to
                booking confirmation. All payments made through the platform are
                securely processed in accordance with local monetary laws and
                banking regulations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                6. Contact Information
              </h2>
              <p>
                For questions regarding these Terms, please contact our legal
                team at{" "}
                <Link
                  href="/contact"
                  className="text-[var(--accent)] underline"
                >
                  Doceeto Contact Support
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
