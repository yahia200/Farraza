import Hero from "@/components/Hero";
import { StepsSection } from "@/components/landing/steps-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CtaSection } from "@/components/landing/cta-section";

function page() {
  return (
    <main data-landing className="min-h-screen pb-24">
      <Hero />
      <StepsSection />
      <FeaturesSection />
      <CtaSection />
    </main>
  );
}

export default page;
