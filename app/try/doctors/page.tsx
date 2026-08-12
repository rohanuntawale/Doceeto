import { PageHeader } from "@/components/layout/page-header";
import { PreviewBanner } from "@/components/try/preview-chrome";
import { ProviderPreview } from "@/components/try/provider-preview";

export const metadata = {
  title: "Doctors on Doceeto",
  description:
    "Browse verified doctors on Doceeto — specialty, experience, languages and home-visit fees, with no account needed.",
};

export default function TryDoctorsPage() {
  return (
    <>
      <PageHeader label="Preview" title="Doctors on Doceeto" />
      <div className="space-y-5">
        <PreviewBanner
          can="This is the real roster — every doctor here is registered and ops-verified."
          needsAccount="Booking, video consults and home visits need an account. It takes a minute."
        />
        <ProviderPreview
          cadre="doctor"
          emptyTitle="No doctors online at the moment"
          emptyDesc="Doceeto is Nagpur-first and still growing. Create an account and you'll be notified the moment a doctor in your area comes online."
        />
      </div>
    </>
  );
}
