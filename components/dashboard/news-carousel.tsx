"use client";

import { useEffect, useState } from "react";
import { Newspaper, ArrowUpRight } from "lucide-react";

type Role = "patient" | "doctor";

interface NewsItem {
  category: string;
  headline: string;
  source: string;
  time: string;
  color: string;
  image: string;
}

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;

const NEWS: Record<Role, NewsItem[]> = {
  patient: [
    { category: "Health", headline: "Monsoon flu cases climb across Nagpur, how to stay safe", source: "Doceeto Health", time: "2h", color: "#8A4B24", image: U("1584982751601-97dcc096659c") },
    { category: "Wellness", headline: "Five symptoms you should never ignore this season", source: "Wellness Desk", time: "5h", color: "#586647", image: U("1505751172876-fa1923c5c528") },
    { category: "Doceeto", headline: "Home visits now available until 11 PM across the city", source: "Doceeto", time: "1d", color: "#9A7433", image: U("1519494026892-80bbd2d6fd0d") },
    { category: "Update", headline: "New guidelines make video consults faster and safer", source: "Health Ministry", time: "2d", color: "#8A4B24", image: U("1576091160399-112ba8d25d1d") },
  ],
  doctor: [
    { category: "Platform", headline: "Instant payouts now settle in under two minutes", source: "Doceeto", time: "3h", color: "#586647", image: U("1554224155-6726b3ff858f") },
    { category: "Guidelines", headline: "Updated teleconsult best-practices for 2026 released", source: "Medical Council", time: "6h", color: "#8A4B24", image: U("1579684385127-1ef15d508118") },
    { category: "Demand", headline: "Peak request hours this week are 8 to 11 PM", source: "Doceeto Insights", time: "1d", color: "#9A7433", image: U("1666214280557-f1b5022eb634") },
    { category: "Tips", headline: "How top freelance doctors earn more on Doceeto", source: "Doceeto", time: "2d", color: "#586647", image: U("1587854692152-cbe660dbde88") },
  ],
};

export function NewsCarousel({ role }: { role: Role }) {
  const items = NEWS[role];
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % items.length), 5000);
    return () => clearInterval(id);
  }, [items.length]);

  return (
    <section className="fh-card overflow-hidden rounded-3xl">
      {/* Hero slideshow */}
      <div className="relative h-52 w-full overflow-hidden">
        {items.map((n, idx) => (
          <div
            key={n.headline}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
            style={{ backgroundImage: `url(${n.image})`, backgroundColor: n.color, opacity: idx === i ? 1 : 0 }}
          >
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.72) 100%)" }}
            />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                <Newspaper className="h-3 w-3" /> {n.category}
              </span>
              <h3 className="mt-2 max-w-[92%] text-[17px] font-bold leading-snug text-white">
                {n.headline}
              </h3>
              <p className="mt-1 text-xs text-white/80">
                {n.source} · {n.time}
              </p>
            </div>
          </div>
        ))}
        {/* Dots */}
        <div className="absolute bottom-3 right-3 z-10 flex gap-1.5">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Slide ${idx + 1}`}
              className="h-1.5 rounded-full bg-white/90 transition-all"
              style={{ width: idx === i ? 18 : 6, opacity: idx === i ? 1 : 0.5 }}
            />
          ))}
        </div>
      </div>

      {/* Overflow headlines */}
      <div className="divide-y divide-[var(--border)]">
        {items.map((n, idx) => (
          <button
            key={n.source + idx}
            onClick={() => setI(idx)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-cream">{n.headline}</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {n.source} · {n.time}
              </span>
            </span>
            {/* This row swaps the hero above, no external page opens, so no
                external-link arrow. */}
          </button>
        ))}
      </div>
    </section>
  );
}
