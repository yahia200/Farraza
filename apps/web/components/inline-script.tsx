/**
 * A script that runs while the HTML is parsed (before first paint) on a full
 * page load, and is inert on the client. From the Next.js guide:
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 * ("Extracting a reusable component"):
 * - server: type="text/javascript", so the browser runs it during parsing;
 * - client: type="text/plain", so React doesn't warn about rendering <script>
 *   and client-side navigations don't run it again;
 * - suppressHydrationWarning covers that type difference.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
