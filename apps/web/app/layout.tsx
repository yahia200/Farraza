import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import { cn } from "@/lib/utils";

const outfit = Outfit({subsets:['latin'],variable:'--font-sans'});

const thunder = localFont({
  src: "./fonts/Thunder-ExtraBoldLC.woff2",
  weight: "900",
  style: "normal",
  variable: "--font-display",
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
      className={cn("h-full", "antialiased", thunder.variable, "font-sans", outfit.variable)}
    >
      <body>
        {children}
      </body>
    </html>
  );
}
