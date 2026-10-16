import { Toaster } from '@/components/ui/toast';

/**
 * Full-page viewers opened in their own tab (a candidate's CV or attachment). No dashboard
 * sidebar and no marketing NavBar: the file gets the whole window. Like every other page, access
 * is enforced by the DAL (signed-out users go to /sign-in, non-members get a 404).
 *
 * Toaster is here because the Download button reports failures with `toast.add()`.
 */
export default function ViewerLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <div className="flex min-h-dvh flex-col">{children}</div>
      <Toaster />
    </>
  );
}
