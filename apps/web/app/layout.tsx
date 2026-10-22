import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const outfit = Outfit({subsets:['latin'],variable:'--font-sans'});

const thunder = localFont({
  src: "./fonts/Thunder-BoldLC.woff2",
  weight: "900",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Farraza",
  description: "Work in progress",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes' inline script sets the theme class
    // on <html> before hydration, so the server HTML and first client render
    // differ on this element by design (next-themes README, "Avoid Hydration
    // Mismatch"). It suppresses the warning for this one element only.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", thunder.variable, "font-sans", outfit.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
