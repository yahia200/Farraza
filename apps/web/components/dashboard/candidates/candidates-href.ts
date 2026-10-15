/** The two ways to look at a job's candidates; `table` is the default and has no ?view. */
export type CandidatesView = 'table' | 'board';

export function parseView(value: string | string[] | undefined): CandidatesView {
  return value === 'board' ? 'board' : 'table';
}

/**
 * A link to the Candidates page that keeps the URL's two pieces of state
 * together: ?view=board (omitted for the default table) and ?application=<id>
 * (the open detail sheet).
 */
export function candidatesHref(basePath: string, { view, application }: { view: CandidatesView; application?: string }) {
  const query = new URLSearchParams();
  if (view === 'board') query.set('view', 'board');
  if (application) query.set('application', application);
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}
