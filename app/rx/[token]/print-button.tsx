"use client";

/**
 * The one interactive control on the shared page. Split out so the page itself
 * stays a server component — the prescription lookup belongs on the server, and
 * nothing else here needs the browser.
 */
import { Download } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:border-terracotta/50 hover:bg-white/5"
    >
      <Download className="h-4 w-4" /> Save as PDF
    </button>
  );
}
