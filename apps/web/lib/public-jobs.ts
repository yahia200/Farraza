import 'server-only';
import { cacheLife, cacheTag, updateTag } from 'next/cache';
import {
  publicBrandingSchema,
  publicCompanyJobsSchema,
  type CvMode,
  type PublicBranding,
  type PublicCompanyJobs,
  type PublicFormField,
} from '@repo/shared';
import { apiUrl } from './api';

/**
 * Data for the public apply page (/{companySlug}/{jobSlug}). Unlike lib/dal.ts
 * it doesn't depend on who is asking, so it's cached once for every visitor
 * and sent without the session cookie.
 *
 * 'use cache: remote', not plain 'use cache': the plain one lives in memory,
 * and on serverless hosting (Vercel) instances don't share or keep memory, so
 * most visits would miss. On Vercel the remote cache is its Runtime Cache
 * (https://vercel.com/docs/caching/runtime-cache); locally it falls back to memory.
 * Docs: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache-remote.md
 */

export interface PublicJob {
  company: { name: string; slug: string; logoUrl: string | null; brandColor: string | null };
  job: { title: string; description: string | null };
  /**
   * Whether the form asks for a CV (the apply form's first step unless `off`). No upload URLs
   * here: this payload is shared by every visitor; `createUpload` (app/actions/applications.ts)
   * mints one per chosen file.
   */
  cvMode: CvMode;
  /** Knockout rules already removed by the API (toPublicFields). */
  fields: PublicFormField[];
}

const jobTag = (companySlug: string, jobSlug: string) => `public-job:${companySlug}/${jobSlug}`;
const companyTag = (companySlug: string) => `public-company:${companySlug}`;
/**
 * The set/titles of a company's open jobs, for the listing page only. Separate
 * from `companyTag` (which every apply page also carries) so a title edit or an
 * open/close busts just the listing, not every apply page of the company.
 */
const companyJobsTag = (companySlug: string) => `public-company-jobs:${companySlug}`;

/** The open job and its published form, or null if it isn't accepting applications. */
export async function getPublicJob(companySlug: string, jobSlug: string): Promise<PublicJob | null> {
  'use cache: remote';
  cacheTag(jobTag(companySlug, jobSlug), companyTag(companySlug));
  // Changes expire the tags right away (expirePublicJob); this is the safety net.
  cacheLife('minutes');

  const response = await fetch(
    apiUrl(`/api/public/${encodeURIComponent(companySlug)}/${encodeURIComponent(jobSlug)}`),
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Could not load the job (HTTP ${response.status}).`);
  }
  return (await response.json()) as PublicJob;
}

/**
 * Drops the cached public page after a change, so the next visitor gets fresh
 * data. Without `jobSlug`, every job of the company (name, logo or color changed).
 * updateTag only works in Server Actions, which is where all changes happen.
 * Docs: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md
 */
export function expirePublicJob(companySlug: string, jobSlug?: string) {
  updateTag(jobSlug ? jobTag(companySlug, jobSlug) : companyTag(companySlug));
}


/**
 * A company's branding and its open jobs, for the listing page at /{companySlug}.
 * Like getPublicJob it doesn't depend on who's asking, so it's cached once for
 * every visitor with 'use cache: remote' and sent without the session cookie.
 * Tagged for surgical invalidation and bounded by cacheLife as a safety net.
 * null means no company has that slug (the page shows notFound()); a real
 * company with no open jobs is a non-null result with an empty `jobs` list.
 */
export async function getCompanyJobs(companySlug: string): Promise<PublicCompanyJobs | null> {
  'use cache: remote';
  cacheTag(companyJobsTag(companySlug), companyTag(companySlug));
  cacheLife('minutes');

  const response = await fetch(apiUrl(`/api/public/${encodeURIComponent(companySlug)}`));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Could not load the company's jobs (HTTP ${response.status}).`);
  }
  // Parse at the trust boundary with the same schema the API shaped its reply
  // with (@repo/shared), so the page works against a checked contract.
  return publicCompanyJobsSchema.parse(await response.json());
}

/**
 * Drops the cached listing after a change to which jobs are open or their
 * titles (job open/close and edit). Branding changes go through expirePublicJob
 * instead, which busts companyTag — a tag the listing also carries.
 */
export function expireCompanyJobs(companySlug: string) {
  updateTag(companyJobsTag(companySlug));
}

/**
 * A company's branding only (name, logo, brand color), for the public layout
 * at /{companySlug}/* to theme every page under it with one cheap call — no
 * jobs, no form. Like the others it's visitor-independent, so it's cached once
 * for everyone with 'use cache: remote' and sent without the session cookie.
 *
 * Tagged with `companyTag` (not `companyJobsTag`): branding changes already
 * bust companyTag via expirePublicJob(companySlug) from the company-settings
 * action, so nothing new has to invalidate it. null means no company has that
 * slug — the layout then renders unthemed and lets the page call notFound().
 */
export async function getBranding(companySlug: string): Promise<PublicBranding | null> {
  'use cache: remote';
  cacheTag(companyTag(companySlug));
  cacheLife('minutes');

  const response = await fetch(
    apiUrl(`/api/public/${encodeURIComponent(companySlug)}/branding`),
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Could not load the company's branding (HTTP ${response.status}).`);
  }
  return publicBrandingSchema.parse(await response.json());
}
