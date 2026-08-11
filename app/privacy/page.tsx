import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = {
  title: "Privacy Policy · Doceeto Health",
  description:
    "Privacy policy and data protection principles for Doceeto users.",
};

export default function PrivacyPage() {
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
            <span className="label">Privacy & Protection</span>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Last updated: August 2026
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-[var(--text-muted)] leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                1. Information We Collect
              </h2>
              <p>
                We collect personal information necessary to deliver health
                services, including account details (name, email, phone number),
                health information (symptoms, consultation notes, prescription
                requests), and location data (for home visits and nearest
                provider matching).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                2. How Information is Used
              </h2>
              <p>
                Your data is exclusively used to facilitate care requests,
                verify practitioner credentials, process payments, and improve
                platform experience. Medical records and consultation notes are
                accessible only by authorized care providers involved in your
                treatment.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                3. Data Security & Storage
              </h2>
              <p>
                Doceeto implements strict encryption and access controls for all
                personal health information (PHI). We adhere to stringent
                digital security protocols aligned with applicable Indian health
                data protection guidelines.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                4. Data Sharing & Third Parties
              </h2>
              <p>
                We do not sell, rent, or trade your personal health data to
                third-party advertisers. Information is shared strictly with
                participating doctors, registered nurses, and pharmacy partners
                as required to complete your health service requests.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[var(--text)] mb-3 font-serif">
                5. Your Rights & Data Deletion
              </h2>
              <p>
                You may request access to, correction of, or deletion of your
                personal account data at any time by reaching out to our support
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
