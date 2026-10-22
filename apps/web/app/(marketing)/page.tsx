import React from "react";
import Hero from "@/components/Hero";
import { StepsSection } from "@/components/landing/steps-section";

function page() {
  return (
    <main data-landing className="min-h-screen pb-[100svh] px-8">
      <Hero />
      <StepsSection />
    </main>
  );
}

export default page;
