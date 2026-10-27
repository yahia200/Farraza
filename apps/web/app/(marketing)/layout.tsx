import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

/**
 * Public marketing pages get the floating NavBar and the Footer; the app's own pages don't.
 * The `light` class keeps them in light colors whatever theme the user picked
 * (see `.light` in globals.css).
 */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-primary-50 dark:bg-background text-foreground">
      <NavBar />
      {children}
      <Footer />
    </div>
  );
}
