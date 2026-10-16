import 'server-only';
import { cacheLife, cacheTag, updateTag } from 'next/cache';
import type { CvMode, PublicFormField } from '@repo/shared';
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
  /** Whether the form asks for a CV (the apply form's first step; not shown yet). */
  cvMode: CvMode;
  /** Knockout rules already removed by the API (toPublicFields). */
  fields: PublicFormField[];
}

const jobTag = (companySlug: string, jobSlug: string) => `public-job:${companySlug}/${jobSlug}`;
const companyTag = (companySlug: string) => `public-company:${companySlug}`;

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
