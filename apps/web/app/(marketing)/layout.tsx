import NavBar from '@/components/NavBar';

/** Public marketing pages get the floating NavBar; the app's own pages don't. */
export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
