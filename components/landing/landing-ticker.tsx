"use client";

export function LandingTicker() {
  const itemsRow1 = [
    "General Checkup",
    "Specialist Consultation",
    "Home Nurse Care",
    "Urgent Care",
    "Pediatric Visit",
    "Prescription Renewal",
    "Elderly Care",
  ];

  const itemsRow2 = [
    "Vitals Monitoring",
    "Post-Op Dressing",
    "Home Visit Doctor",
    "Chronic Disease Care",
    "Diagnostic Help",
    "In-Person Nursing",
    "Emergency Care",
  ];

  return (
    <div className="space-y-3 py-4 border-y-2 border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm overflow-hidden select-none">
      {/* Row 1: Leftward Marquee */}
      <div className="flex overflow-hidden">
        <div className="flex animate-marquee-left gap-8 whitespace-nowrap text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-[var(--text)] opacity-90">
          {Array.from({ length: 4 }).flatMap((_, idx) =>
            itemsRow1.map((item, itemIdx) => (
              <span key={`r1-${idx}-${itemIdx}`} className="flex items-center gap-6">
                <span>{item}</span>
                <span className="text-[var(--accent)]">•</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Row 2: Rightward Marquee */}
      <div className="flex overflow-hidden">
        <div className="flex animate-marquee-right gap-8 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)] opacity-75">
          {Array.from({ length: 4 }).flatMap((_, idx) =>
            itemsRow2.map((item, itemIdx) => (
              <span key={`r2-${idx}-${itemIdx}`} className="flex items-center gap-6">
                <span>{item}</span>
                <span className="text-[#2F7BC4]">•</span>
              </span>
            ))
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee-left {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .animate-marquee-left {
          animation: marquee-left 35s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 40s linear infinite;
        }
      `}</style>
    </div>
  );
}
