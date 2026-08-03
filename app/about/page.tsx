import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "About · Doceeto Health",
  description: "One place for care in India: doctors, diagnostics and medicine.",
};

const PILLARS = [
  { name: "Satori", role: "the check", desc: "Describe what you're feeling and a guided symptom check points you to the right kind of doctor before you book." },
  { name: "Zumi", role: "the doctor", desc: "Freelance doctors on demand, the way Uber did for cabs. See who is nearby, book a home visit, a clinic visit, or a video call." },
  { name: "Kenshin", role: "the network", desc: "Diagnostic kiosks around the city, like metro machines. Walk up, get screened, and walk away with a plan." },
  { name: "AuraMed", role: "the medicine", desc: "When a doctor writes a prescription, the medicine is delivered to your door in about ten minutes." },
];

const STATS = [
  { value: "0.7", label: "doctors per 1,000 people, below the WHO benchmark of 1" },
  { value: "1.7L", label: "road-accident deaths a year, most without care in the first hour" },
  { value: "50%", label: "of health spending is paid out of pocket, among the world's highest" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
        {/* Hero */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-terracotta" />
            <span className="label">About Doceeto</span>
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-tight text-cream md:text-6xl">
            One front door <span className="text-salmon">to care.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
            In India, when something goes wrong, care is a scramble: which
            number, which doctor, which app. Doceeto puts emergencies, doctors,
            diagnostics and medicine in one place, ready when you need them.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card"
            >
              <div className="metric text-4xl text-salmon">{s.value}</div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--text-faint)]">
          Figures illustrative, from public India health data.
        </p>

        {/* Mission */}
        <div className="mt-16 grid gap-6 border-t border-[var(--border)] pt-12 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="label">Our mission</div>
            <h2 className="mt-2 font-serif text-3xl text-cream">
              Healing, on demand.
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">
            The pieces finally exist: a phone in every hand, digital identity and
            payments, telehealth people now trust, and a generation that expects
            things in ten minutes. We are putting those pieces together into care.
            We start with the most urgent, most common moments, then grow into
            everyday health, one patient at a time.
          </p>
        </div>

        {/* Pillars */}
        <div className="mt-16 border-t border-[var(--border)] pt-12">
          <div className="label">The platform</div>
          <h2 className="mt-2 font-serif text-3xl text-cream">
            Four pillars, one loop.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <div
                key={p.name}
                className="rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-terracotta/12 font-serif text-lg text-salmon ring-1 ring-inset ring-terracotta/20">
                    {p.name.charAt(0)}
                  </span>
                  <div>
                    <div className="font-serif text-xl text-cream">{p.name}</div>
                    <div className="text-xs text-[var(--text-faint)]">{p.role}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-[var(--text-muted)]">
            Each part makes the next one stronger: more users, more doctors, more
            data, and faster, cheaper, better care.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-16 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-12">
          <Link href="/">
            <Button size="lg">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline" size="lg">
              Contact us
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
