import { LandingHero } from "@/components/landing/landing-hero";
import { LandingStory } from "@/components/landing/landing-story";
import { LandingTwoSides } from "@/components/landing/landing-two-sides";
import { LandingConnection } from "@/components/landing/landing-connection";
import { LandingProductShowcase } from "@/components/landing/landing-product-showcase";
import { LandingFinalCta } from "@/components/landing/landing-final-cta";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function Page() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SiteHeader />
      <main>
        <LandingHero />
        <LandingStory />
        <LandingTwoSides />
        <LandingConnection />
        <LandingProductShowcase />
        <LandingFinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

