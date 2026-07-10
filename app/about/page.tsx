import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "About · Iyashi Health",
  description: "One front door to care in India — emergencies, doctors, diagnostics and medicine.",
};

const PILLARS = [
  { kanji: "助", name: "Tasuke", role: "the button", desc: "One SOS press sends your location and profile to the nearest ambulance and a doctor — care in the golden minutes." },
  { kanji: "医", name: "Zumi", role: "the doctor", desc: "On-demand freelance doctors, the way Uber moved cars — nearest, available and transparent, video or at your door." },
  { kanji: "検", name: "Kenshin", role: "the network", desc: "Diagnostic kiosks across the city, like metro machines — walk up, get screened, walk away with a plan." },
  { kanji: "薬", name: "AuraMed", role: "the medicine", desc: "The moment a doctor prescribes, medicine is delivered — closing the loop from diagnosis to recovery in ~10 minutes." },
];

const STATS = [
  { value: "0.7", label: "doctors per 1,000 — below the WHO benchmark of 1" },
  { value: "1.7L", label: "road-accident deaths a year, most without golden-hour care" },
  { value: "50%", label: "of health spending is out-of-pocket, among the world's highest" },
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
            <span className="label">About Iyashi · 癒し</span>
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-tight text-cream md:text-6xl">
            One front door <span className="text-salmon">to care.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
            In India, when the moment comes, care is improvised — which number,
            which doctor, which app. Iyashi assembles emergencies, doctors,
            diagnostics and medicine into a single platform, brought to the
            instant they’re needed.
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
            The rails finally exist — a phone in every hand, public identity and
            payment rails, normalised telehealth, and a generation that expects
            things in ten minutes. Everything Iyashi needs has been built. We are
            assembling it into healing — starting with the highest-urgency,
            highest-frequency moments, then expanding into the full continuum of
            care, one patient relationship at a time.
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
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-terracotta/12 font-jp text-lg text-salmon ring-1 ring-inset ring-terracotta/20">
                    {p.kanji}
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
            Each phase makes the next stronger — more users, more doctors, more
            data, and faster, cheaper, better care.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-16 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-12">
          <Link href="/register">
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
