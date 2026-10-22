import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { cacheLife } from "next/cache";

/**
 * Site footer for the marketing pages. It renders outside <main>, so the
 * browser exposes it as the page's `contentinfo` landmark. Its <nav> has a
 * label so screen readers can tell it apart from the NavBar's.
 */
function Footer() {
  return (
    <footer className="p-4">
      <div className="relative overflow-hidden flex flex-col items-center justify-between p-8 md:pt-12 md:pb-[12vw] bg-primary-950 text-primary-foreground rounded-4xl">
        <div className="flex flex-col gap-8 w-full max-w-[83vw] md:flex-row md:justify-between">
          <div className="flex flex-col gap-2 h-full">
            <Link
              href="/"
              className="flex items-center gap-2 font-medium text-lg"
            >
              {/* Decorative: the brand name next to it is the link text. */}
              <Image src="/Logo_white.svg" alt="" width={24} height={24} />
              <span>Khatwateen</span>
            </Link>
            <p>The applicant tracking system for small teams.</p>
            <p className="text-sm text-primary-foreground/70 hidden md:block">
              <small>
                © <CopyrightYear /> Khatwateen. All rights reserved.
              </small>
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-col gap-8 md:gap-18 md:flex-row"
          >
            <div>
              <h2 className="font-medium text-lg mb-1">Product</h2>
              <ul className="flex flex-col">
                <li>
                  <Link
                    href="/#landing-steps-heading"
                    className={cn(
                      buttonVariants({ variant: "link" }),
                      "p-0 text-primary-foreground h-auto",
                    )}
                  >
                    How it works
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className={cn(
                      buttonVariants({ variant: "link" }),
                      "p-0 text-primary-foreground h-auto",
                    )}
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="font-medium text-lg mb-1">Account</h2>
              <ul className="flex flex-col">
                <li>
                  <Link
                    href="/sign-in"
                    className={cn(
                      buttonVariants({ variant: "link" }),
                      "p-0 text-primary-foreground h-auto",
                    )}
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sign-up"
                    className={cn(
                      buttonVariants({ variant: "link" }),
                      "p-0 text-primary-foreground h-auto",
                    )}
                  >
                    Create an account
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <p className="text-sm mt-8 text-primary-foreground/70 block md:hidden">
          <small>
            © <CopyrightYear /> Khatwateen. All rights reserved.
          </small>
        </p>

        <p className="hidden md:block text-[15vw] font-extrabold leading-0 text-center text-brand-accent absolute bottom-[0.112em] left-1/2 -translate-x-1/2 pointer-events-none select-none">
          khatwateen
        </p>
      </div>
    </footer>
  );
}

async function CopyrightYear() {
  "use cache";
    cacheLife('days')
  return new Date().getFullYear();
}

export default Footer;
