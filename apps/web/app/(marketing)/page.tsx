import React from "react";
import Hero from "@/components/Hero";
import { StepsSection } from "@/components/landing/steps-section";
import { FeaturesSection } from "@/components/landing/features-section";

function page() {
  return (
    <main data-landing className="min-h-screen pb-24 px-8">
      <Hero />
      <StepsSection />
      <FeaturesSection />
    </main>
  );
}

export default page;
