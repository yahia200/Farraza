import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { cacheLife } from "next/cache";
import LogoName from "@/components/logo-name";
/**
 * Site footer for the marketing pages. It renders outside <main>, so the
 * browser exposes it as the page's `contentinfo` landmark. Its <nav> has a
 * label so screen readers can tell it apart from the NavBar's.
 */
function Footer() {
  return (
    <footer className="p-4">
      <div className="relative overflow-hidden flex flex-col items-center justify-between p-8 md:pt-12 md:pb-[13vw] bg-primary-950 dark:bg-brand-accent text-primary-foreground dark:text-background rounded-4xl">
        <div className="flex flex-col gap-8 w-full max-w-400 md:flex-row md:justify-between">
          <div className="flex flex-col gap-2 h-full">
            <Link
              href="/"
              className="flex items-center gap-2 font-medium text-lg"
            >
              {/* Decorative: the brand name next to it is the link text. */}
              <LogoName className="h-5 fill-white dark:fill-background" />
            </Link>
            <p>The applicant tracking system for small teams.</p>
            <p className="text-sm text-background/70 hidden md:block">
              <small>
                © <CopyrightYear /> Farraza. All rights reserved.
              </small>
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-col gap-8 md:gap-18 md:flex-row"
          >
            <div>
              <h2 className="font-medium text-lg mb-1">Product</h2>
              <ul className="flex flex-col **:text-background **:p-0 **:h-auto">
                <li>
                  <Link
                    href="/#landing-steps-heading"
                    className={cn(buttonVariants({ variant: "link" }))}
                  >
                    How it works
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className={cn(buttonVariants({ variant: "link" }))}
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="font-medium text-lg mb-1">Account</h2>
              <ul className="flex flex-col **:text-background **:p-0 **:h-auto">
                <li>
                  <Link
                    href="/sign-in"
                    className={cn(buttonVariants({ variant: "link" }))}
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sign-up"
                    className={cn(buttonVariants({ variant: "link" }))}
                  >
                    Create an account
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <p className="text-sm mt-8 text-primary-foreground/70 dark:text-background/70 block md:hidden">
          <small>
            © <CopyrightYear /> Farraza. All rights reserved.
          </small>
        </p>

        <p className="hidden md:block text-[20vw] font-extrabold leading-0 text-center text-brand-accent dark:text-primary absolute bottom-[0.125em] left-1/2 -translate-x-1/2 pointer-events-none select-none">
          farraza
        </p>
      </div>
    </footer>
  );
}

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export default Footer;
