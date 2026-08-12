import { PageHeader } from "@/components/layout/page-header";
import { PreviewBanner } from "@/components/try/preview-chrome";
import { ProviderPreview } from "@/components/try/provider-preview";

export const metadata = {
  title: "Home care nurses on Doceeto",
  description:
    "Browse verified home care nurses on Doceeto — dressings, injections, vitals and elder care, with no account needed.",
};

export default function TryNursesPage() {
  return (
    <>
      <PageHeader label="Preview" title="Home care nurses" />
      <div className="space-y-5">
        <PreviewBanner
          can="Nurses handle the hands-on work at home: dressings, injections, vitals and elder care."
          needsAccount="Sending a nurse to an address needs an account, so we know where they're going."
        />
        <ProviderPreview
          cadre="nurse"
          emptyTitle="No nurses online at the moment"
          emptyDesc="Every nurse is checked by our team before they can be dispatched to a home, so the list grows carefully. Create an account to be told when one is free near you."
        />
      </div>
    </>
  );
}
