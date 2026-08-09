import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";

export function LandingProductShowcase() {
  return (
    <section id="showcase" className="py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <p className="label">Product showcase</p>
          <h2 className="mt-4 text-4xl font-serif tracking-tight text-[var(--text)] sm:text-5xl">
            The platform feels familiar, focused, and built to move care forward.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-muted)]">
            Real product panels, clean information density, and the same tone of care that carries through the app experience.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <GlassCard className="p-6">
            <p className="label">Patient view</p>
            <div className="mt-6 space-y-5">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
                  <span>Care request</span>
                  <span>₹499</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">General Checkup</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                  Find the right doctor, compare availability, and book a consultation without chasing multiple clinics.
                </p>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg)] p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--text-faint)]">Live status</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-status-ok" />
                  <span className="text-sm text-[var(--text-muted)]">Platform live • patient requests accepted now</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <p className="label">Doctor view</p>
            <div className="mt-6 space-y-5">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
                  <span>New consultation</span>
                  <span>₹999</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">Specialist visit</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                  Share your profile details, fees, and languages once. Patients see your offer and choose the right doctor directly.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard value="148" label="Active doctors" sub="across the platform" accent />
                <StatCard value="93%" label="Request response" sub="within the first hour" />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

