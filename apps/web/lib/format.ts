/**
 * Dates shown in the UI, formatted on the server with a fixed locale and time
 * zone: formatting in the browser could differ from the server's HTML and
 * break hydration (02-guides/preventing-flash-before-hydration.md, "Dates and formatting").
 */
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "13 Oct 2026" */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
