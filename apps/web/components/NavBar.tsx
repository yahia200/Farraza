import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import LogoName from "@/components/logo-name";
import type { CurrentUser } from "@/lib/dal";
import { getCurrentUserOrNull } from "@/lib/dal";
import { Suspense } from "react";

async function CTA() {
  const user: CurrentUser | null = await getCurrentUserOrNull();
  {
    return user ? (
      <Link
        className={cn(buttonVariants({ variant: "default" }), "px-10")}
        href="/dashboard"
      >
        Dashboard
      </Link>
    ) : (
      <Link
        className={cn(buttonVariants({ variant: "default" }), "px-10")}
        href="/sign-in"
      >
        Login
      </Link>
    );
  }
}

function NavBar() {
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-2/3 min-w-xs max-w-4xl bg-brand-accent/65 backdrop-blur-md z-99 rounded-full flex items-center justify-between p-1 shadow-lg">
      <div className="flex items-center gap-4 pl-2">
        <LogoName className="h-3.5 fill-primary" />
      </div>

      <div>
        <Suspense
          fallback={
            <Skeleton
              className={cn(buttonVariants({ variant: "default" }), "px-10")}
            >
              <p className="invisible" aria-hidden="true">
                Dashboard
              </p>
            </Skeleton>
          }
        >
          <CTA />
        </Suspense>
      </div>
    </nav>
  );
}

export default NavBar;
