import NavBar from '@/components/NavBar';

/**
 * Public marketing pages get the floating NavBar; the app's own pages don't.
 * The `light` class keeps them in light colors whatever theme the user picked
 * (see `.light` in globals.css).
 */
export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="light bg-primary-50 text-foreground">
      <NavBar />
      {children}
    </div>
  );
}
