import type { Metadata } from "next";
import { Righteous, Outfit } from "next/font/google";
import "./globals.css";

import NavBar from '@/components/NavBar'
import { cn } from "@/lib/utils";

const outfit = Outfit({subsets:['latin'],variable:'--font-sans'});

const righteous = Righteous({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-righteous",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Khatwateen",
  description: "Work in progress",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", righteous.variable, "font-sans", outfit.variable)}
    >
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
