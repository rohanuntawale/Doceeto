"use client";

export function LandingTicker() {
  const items = [
    "General Checkup",
    "Specialist Visit",
    "Pediatric Care",
    "Urgent Care",
    "Follow-up",
  ];

  return (
    <div className="mt-16 overflow-hidden border-t border-b border-[var(--border)] bg-[var(--bg)]/80 py-5">
      <div className="mx-auto flex min-w-full max-w-6xl animate-marquee gap-8 px-6 text-sm font-semibold uppercase tracking-[0.32em] text-[var(--text-muted)]">
        {Array.from({ length: 3 }).flatMap((_, index) =>
          items.map((item) => (
            <span key={`${item}-${index}`} className="whitespace-nowrap">
              {item}
            </span>
          )),
        )}
      </div>
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.3333%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}

