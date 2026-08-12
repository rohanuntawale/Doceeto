import Link from "next/link";
import { AlertTriangle, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PreviewBanner } from "@/components/try/preview-chrome";
import { ProviderPreview } from "@/components/try/provider-preview";

export const metadata = {
  title: "Urgent care on Doceeto",
  description:
    "Doctors free to take a request right now on Doceeto — live availability, no account needed to look.",
};

export default function TryUrgentPage() {
  return (
    <>
      <PageHeader label="Live" title="Free to see you now" />

      <div className="space-y-5">
        {/* First, and before anything else on the page. Someone who typed
            "urgent" may be in the wrong place entirely, and a marketplace that
            waits until the third scroll to say so has failed them. */}
        <Card className="flex items-start gap-3 border-status-critical/40 bg-status-critical/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">
              If this is a medical emergency, call 112 now
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Chest pain, trouble breathing, heavy bleeding, a seizure or a suspected stroke need an
              ambulance, not an app.{" "}
              <Link href="/legal/emergency" className="underline underline-offset-2">
                What Doceeto can and cannot do
              </Link>
            </p>
          </div>
          <a
            href="tel:112"
            className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-status-critical px-3 py-1.5 text-xs font-semibold text-white sm:flex"
          >
            <Phone className="h-3.5 w-3.5" />
            112
          </a>
        </Card>

        <PreviewBanner
          can="Only doctors who are online and not already with a patient. The list updates every few seconds."
          needsAccount="Sending a request needs an account — it goes to every free doctor near you at once, and the first to accept takes it."
        />

        {/* urgentOnly: online AND not on a gig AND not mid-consult. Anything
            looser would list someone who cannot actually come, which is the
            one promise this page has to keep. */}
        <ProviderPreview
          cadre="doctor"
          urgentOnly
          emptyTitle="No doctors free this minute"
          emptyDesc="Availability moves quickly — this page refreshes on its own. With an account you can send a request that waits for the next doctor to come free instead of watching for one."
        />
      </div>
    </>
  );
}
