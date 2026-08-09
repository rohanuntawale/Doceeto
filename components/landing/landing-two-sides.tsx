import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingTwoSides() {
  return (
    <section id="patient-doctor" className="py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-card">
            <p className="label">For patients</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
              Start with what you need.
            </h3>
            <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
              Share your symptoms, access care recommendations, and connect with
              a doctor on your terms. Doceeto keeps the search simple and the
              care sequence clear.
            </p>
            <div className="mt-8">
              <Link href="/signup">
                <Button size="lg">I need care</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-card">
            <p className="label">For doctors</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
              Put your expertise where it matters.
            </h3>
            <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
              Create a service profile, publish your practice details, and let
              patients find you through a direct, trusted connection. One
              signup, one profile, one path to practice.
            </p>
            <div className="mt-8">
              <Link href="/signup?as=doctor">
                <Button variant="outline" size="lg">
                  I&apos;m a doctor
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

