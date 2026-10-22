'use client';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

/**
 * Wraps next-themes' provider (node_modules/next-themes/dist/index.d.ts) with
 * the defaults the shadcn dark-mode guide prescribes
 * (https://ui.shadcn.com/docs/dark-mode/next):
 *
 * - attribute="class": toggles the `.dark` class on <html>, which is what the
 *   `dark` custom variant and the `.dark { ... }` token block in globals.css
 *   key off.
 * - defaultTheme="system" + enableSystem: with no saved choice, follow the OS
 *   `prefers-color-scheme` and keep following it live.
 * - disableTransitionOnChange: suppress CSS transitions during the swap so
 *   colors don't animate when the theme flips.
 *
 * next-themes is purely client-side (an inline script + localStorage), so it
 * doesn't read cookies on the server and sidesteps the cacheComponents /
 * Suspense concern that the sidebar's cookie needs the InlineScript dance for.
 * The root layout must set suppressHydrationWarning on <html> because that
 * inline script writes the class before React hydrates.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
