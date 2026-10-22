import React from "react";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

function NavBar() {
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-2/3 min-w-xs max-w-4xl bg-brand-accent/65 backdrop-blur-md z-99 rounded-full flex items-center justify-between p-1 shadow-lg">
      <div className="flex items-center gap-4 pl-1">
        <span className="flex items-center text-sm font-bold">
          <img src="/logo.svg" alt="Logo" className="size-6" />
        </span>
        <div>
          {/* <Link
            className={cn(buttonVariants({ variant: "link" }), "text-foreground")}
            href="/dashboard"
          >
            Dashboard
          </Link> */}
        </div>
      </div>

      <div>
        <Link
          className={cn(buttonVariants({ variant: "default" }), "px-10 border-0")}
          href="/sign-in"
        >
          Login
        </Link>
      </div>
    </nav>
  );
}

export default NavBar;
