/**
 * The shared prescription: /rx/<token>.
 *
 * The page a WhatsApp link opens. No session, no app shell, no navigation —
 * whoever holds the link is a chemist, a relative, or the patient on a
 * borrowed phone, and the only thing any of them came for is the document.
 *
 * Server-rendered on purpose. The token IS the credential, so the lookup
 * belongs on the server, and rendering there means the page is readable the
 * instant it opens on a slow connection at a pharmacy counter.
 *
 * `noindex` is not decoration: an unguessable URL stops being unguessable the
 * moment a search engine lists it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { FileWarning } from "lucide-react";
import { db as repo } from "@/lib/db";
import { PrescriptionSheet } from "@/components/prescription/prescription-sheet";
import { PrintButton } from "@/app/rx/[token]/print-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prescription · Doceeto",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedPrescriptionPage({
  params,
}: {
  params: { token: string };
}) {
  const rx = await repo.getPrescriptionByToken(params.token);

  if (!rx) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
        <FileWarning className="h-8 w-8 text-[var(--text-faint)]" />
        <h1 className="mt-3 font-serif text-xl text-cream">This link doesn&apos;t open a prescription</h1>
        <p className="mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">
          It may have been mistyped or only partly copied. Ask the patient to share it again from
          their Doceeto account.
        </p>
        <Link
          href="/"
          className="mt-5 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-on-accent"
        >
          Go to Doceeto
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-3 py-6 sm:px-4 sm:py-10">
      <PrescriptionSheet rx={rx} />

      <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--text-faint)]">
          Shared by the patient. This is a copy of a prescription issued on Doceeto, check the code
          and the doctor&apos;s registration number against the original if anything looks wrong.
        </p>
        <PrintButton />
      </div>
    </main>
  );
}
