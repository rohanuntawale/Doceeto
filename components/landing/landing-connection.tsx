export function LandingConnection() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-[var(--surface)] py-24 sm:py-28">
      <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(201,162,74,0.12),transparent_60%)]" aria-hidden />
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="max-w-xl">
            <p className="label">How it works</p>
            <h2 className="mt-4 text-4xl font-serif tracking-tight text-[var(--text)] sm:text-5xl">
              Patient need meets doctor expertise through one seamless connection.
            </h2>
            <div className="mt-8 space-y-6 text-lg leading-relaxed text-[var(--text-muted)]">
              <p>
                Patients describe their need and doctors publish their practice profile. Doceeto routes the right match, gives both sides a shared view, and keeps the signup path simple.
              </p>
              <p>
                The platform is the bridge — a single portal that converts care requests into trusted consultations and verified expertise into meaningful patient support.
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-espresso-900/50 p-8 shadow-card">
            <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.08), transparent 24%), radial-gradient(circle at 80% 18%, rgba(201,162,74,0.18), transparent 20%)" }} aria-hidden />
            <div className="relative h-[420px] w-full">
              <svg viewBox="0 0 720 420" className="h-full w-full" aria-hidden>
                <defs>
                  <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(255,255,255)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="rgb(201,162,74)" stopOpacity="0.9" />
                  </linearGradient>
                </defs>
                <path d="M 120 340 C 220 240 320 230 380 230" fill="none" stroke="url(#line-gradient)" strokeWidth="5" strokeLinecap="round" />
                <path d="M 520 190 C 580 190 620 200 660 130" fill="none" stroke="url(#line-gradient)" strokeWidth="5" strokeLinecap="round" />
                <circle cx="120" cy="340" r="30" fill="rgba(255,255,255,0.08)" stroke="rgb(255,255,255,0.28)" strokeWidth="2" />
                <circle cx="120" cy="340" r="12" fill="rgb(255,255,255)" />
                <circle cx="380" cy="230" r="42" fill="rgba(201,162,74,0.15)" stroke="rgb(201,162,74,0.4)" strokeWidth="3" />
                <circle cx="380" cy="230" r="16" fill="rgb(255,255,255)" />
                <circle cx="660" cy="130" r="30" fill="rgba(255,255,255,0.08)" stroke="rgb(255,255,255,0.28)" strokeWidth="2" />
                <circle cx="660" cy="130" r="12" fill="rgb(255,255,255)" />
                <text x="120" y="286" textAnchor="middle" className="text-[14px] fill-[var(--text-muted)]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
                  Need
                </text>
                <text x="380" y="190" textAnchor="middle" className="text-[14px] fill-[var(--text-muted)]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
                  Doceeto
                </text>
                <text x="660" y="90" textAnchor="middle" className="text-[14px] fill-[var(--text-muted)]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
                  Expertise
                </text>
                <circle cx="220" cy="260" r="10" fill="rgb(255,255,255)" opacity="0.5" />
                <circle cx="320" cy="250" r="8" fill="rgb(255,255,255)" opacity="0.4" />
                <circle cx="500" cy="180" r="10" fill="rgb(255,255,255)" opacity="0.5" />
                <circle cx="600" cy="170" r="8" fill="rgb(255,255,255)" opacity="0.4" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
