import { LandingTicker } from "./landing-ticker";

export function LandingStory() {
  return (
    <section id="story" className="relative overflow-hidden bg-[var(--surface)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-16 lg:grid-cols-[0.95fr_0.85fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="label mb-4">Healthcare, made direct</p>
            <h2 className="font-serif text-4xl sm:text-5xl tracking-tight text-[var(--text)]">
              Healthcare starts with a need. Expertise starts with a doctor. Doceeto brings the two together.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[var(--text-muted)]">
              One platform for patients and doctors, with a single entry point to sign up. No clinic navigation, no duplicate onboarding, and a single route for every care journey.
            </p>
          </div>

          <div className="rounded-[32px] border border-[var(--border)] bg-[var(--bg)] p-8 shadow-card">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--text-faint)]">Verified care packages</p>
            <div className="mt-7 grid gap-4 text-[var(--text)]">
              {[
                { label: "General Checkup", price: "₹499" },
                { label: "Specialist Visit", price: "₹999" },
                { label: "Pediatric Care", price: "₹699" },
                { label: "Urgent Care", price: "₹799" },
                { label: "Follow-up", price: "₹299" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-3xl border border-[var(--border)] bg-espresso-900/50 px-4 py-3">
                  <span className="font-medium">{item.label}</span>
                  <span className="font-semibold text-cream">{item.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <LandingTicker />
    </section>
  );
}
