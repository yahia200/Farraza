import 'server-only';
import { notFound, redirect } from 'next/navigation';
import type { ActivityEvent, ActivityNote, Answers, FormFields } from '@repo/shared';
import { apiFetch } from './api';

/**
 * Data Access Layer: the one place that resolves "who is signed in".
 * Pattern: node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md (Step 1)
 */

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

/**
 * The signed-in user, or a redirect to /sign-in.
 * `use cache: private` may read cookies and keeps the result in the browser
 * only. Callers must render inside a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  'use cache: private';

  const response = await apiFetch('/api/users/me');
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    throw new Error(`Could not load the current user (HTTP ${response.status}).`);
  }

  const user = (await response.json()) as CurrentUser;
  // Expose only what the UI needs.
  return { id: user.id, name: user.name, email: user.email };
}

/** Mirrors CompanyWithRole in apps/api/src/companies/company.ts. */
export interface MyCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
  role: 'owner' | 'admin' | 'recruiter' | 'interviewer';
}

/**
 * The companies the signed-in user belongs to. An empty list means they
 * haven't finished onboarding. Actions that change memberships must call
 * revalidatePath() so this private cache doesn't serve a stale list.
 */
export async function getMyCompanies(): Promise<MyCompany[]> {
  'use cache: private';

  const response = await apiFetch('/api/companies');
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    throw new Error(`Could not load your companies (HTTP ${response.status}).`);
  }

  const companies = (await response.json()) as MyCompany[];
  return companies.map(toMyCompany);
}

/**
 * One company the signed-in user belongs to, by slug, or the not-found page.
 * The API answers 404 to non-members as well, so this doubles as the
 * membership check for every /dashboard/[companySlug] page.
 */
export async function getCompany(slug: string): Promise<MyCompany> {
  'use cache: private';

  const response = await apiFetch(`/api/companies/${encodeURIComponent(slug)}`);
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error(`Could not load the company (HTTP ${response.status}).`);
  }
  return toMyCompany((await response.json()) as MyCompany);
}

/** Mirrors Member in apps/api/src/companies/company.ts (dates arrive as ISO strings). */
export interface CompanyMember {
  userId: string;
  name: string;
  email: string;
  role: MyCompany['role'];
  joinedAt: string;
}

/** The company's members. Any member may list them; the API checks membership. */
export async function getMembers(slug: string): Promise<CompanyMember[]> {
  'use cache: private';

  const response = await apiFetch(`/api/companies/${encodeURIComponent(slug)}/members`);
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error(`Could not load the members (HTTP ${response.status}).`);
  }

  const members = (await response.json()) as CompanyMember[];
  return members.map(({ userId, name, email, role, joinedAt }) => ({ userId, name, email, role, joinedAt }));
}

export type JobStatus = 'draft' | 'open' | 'closed';

/** Mirrors Job in apps/api/src/jobs/job.ts (dates arrive as ISO strings). */
export interface CompanyJob {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: JobStatus;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

/** Mirrors Stage in apps/api/src/jobs/job.ts. */
export interface JobStage {
  id: string;
  name: string;
  position: number;
  kind: 'normal' | 'hired' | 'rejected';
}

const jobsPath = (companySlug: string, jobSlug?: string) =>
  `/api/companies/${encodeURIComponent(companySlug)}/jobs${jobSlug ? `/${encodeURIComponent(jobSlug)}` : ''}`;

/** A company's jobs, newest first (the API's order). */
export async function getJobs(companySlug: string): Promise<CompanyJob[]> {
  'use cache: private';

  const response = await apiFetch(jobsPath(companySlug));
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error(`Could not load the jobs (HTTP ${response.status}).`);
  }
  return ((await response.json()) as CompanyJob[]).map(toCompanyJob);
}

/** One job with its pipeline stages, or the not-found page. */
export async function getJob(companySlug: string, jobSlug: string): Promise<CompanyJob & { stages: JobStage[] }> {
  'use cache: private';

  const response = await apiFetch(jobsPath(companySlug, jobSlug));
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error(`Could not load the job (HTTP ${response.status}).`);
  }
  const job = (await response.json()) as CompanyJob & { stages: JobStage[] };
  return {
    ...toCompanyJob(job),
    stages: job.stages.map(({ id, name, position, kind }) => ({ id, name, position, kind })),
  };
}

/** Whether the job has a published application form: required before it can be opened. */
export async function hasPublishedForm(companySlug: string, jobSlug: string): Promise<boolean> {
  'use cache: private';

  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/form`);
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    throw new Error(`Could not load the application form (HTTP ${response.status}).`);
  }
  const form = (await response.json()) as { published: unknown | null };
  return form.published !== null;
}

/** Mirrors FormVersion in apps/api/src/forms/form.ts (dates arrive as ISO strings). */
export interface FormVersionView {
  version: number;
  fields: FormFields;
  publishedAt: string | null;
  updatedAt: string;
}

/** A job's application form: the version being edited and the one applicants see. */
export async function getJobForm(
  companySlug: string,
  jobSlug: string,
): Promise<{ draft: FormVersionView | null; published: FormVersionView | null }> {
  'use cache: private';

  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/form`);
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error(`Could not load the application form (HTTP ${response.status}).`);
  }
  const form = (await response.json()) as { draft: FormVersionView | null; published: FormVersionView | null };
  const pick = (v: FormVersionView | null) =>
    v && { version: v.version, fields: v.fields, publishedAt: v.publishedAt, updatedAt: v.updatedAt };
  return { draft: pick(form.draft), published: pick(form.published) };
}

function toCompanyJob({ id, title, slug, description, status, openedAt, closedAt, createdAt }: CompanyJob): CompanyJob {
  return { id, title, slug, description, status, openedAt, closedAt, createdAt };
}

/** Expose only what the UI needs. */
function toMyCompany({ id, name, slug, logoUrl, brandColor, role }: MyCompany): MyCompany {
  return { id, name, slug, logoUrl, brandColor, role };
}

// --- Applications (apps/api/src/pipeline) ------------------------------------

/** Mirrors ApplicationStatus in apps/api/src/pipeline/pipeline.ts. */
export type ApplicationStatus = 'active' | 'rejected' | 'hired' | 'withdrawn';

/** One application in a job's list, with the stage it's in. */
export interface ApplicationSummary {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  candidate: { name: string; email: string };
  stage: JobStage;
}

/**
 * A job's applications. The API answers with its pipeline board (stages, each
 * with its applications); the list view only needs one row per application.
 */
export async function getApplications(companySlug: string, jobSlug: string): Promise<ApplicationSummary[]> {
  'use cache: private';

  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/applications`);
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error(`Could not load the applications (HTTP ${response.status}).`);
  }
  const board = (await response.json()) as {
    columns: (JobStage & {
      applications: { id: string; status: ApplicationStatus; submittedAt: string; candidate: ApplicationSummary['candidate'] }[];
    })[];
  };
  return board.columns.flatMap(({ id, name, position, kind, applications }) =>
    applications.map(({ id: applicationId, status, submittedAt, candidate }) => ({
      id: applicationId,
      status,
      submittedAt,
      candidate: { name: candidate.name, email: candidate.email },
      stage: { id, name, position, kind },
    })),
  );
}

/** Mirrors ApplicationDetail in apps/api/src/pipeline/pipeline.ts (dates as ISO strings). */
export interface ApplicationDetailView {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  source: string | null;
  stage: Pick<JobStage, 'id' | 'name' | 'kind'>;
  candidate: { name: string; email: string; phone: string };
  /** The form version the candidate answered (with knockout rules: members only). */
  fields: FormFields;
  answers: Answers;
  /** Set when an auto-reject rule moved the application to Rejected. */
  autoRejectedBy: { fieldKey: string; fieldLabel: string } | null;
  /** The application's history and its notes, oldest first; `buildActivityTimeline` joins them. */
  events: ActivityEvent[];
  notes: ActivityNote[];
}

/** One application in full, or null if it isn't in this job (the sheet says so). */
export async function getApplication(
  companySlug: string,
  jobSlug: string,
  applicationId: string,
): Promise<ApplicationDetailView | null> {
  'use cache: private';

  const response = await apiFetch(
    `${jobsPath(companySlug, jobSlug)}/applications/${encodeURIComponent(applicationId)}`,
  );
  if (response.status === 401) {
    redirect('/sign-in');
  }
  // 404: not in this job; 400: the id in the URL isn't a UUID (ParseUUIDPipe).
  if (response.status === 404 || response.status === 400) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Could not load the application (HTTP ${response.status}).`);
  }
  const detail = (await response.json()) as Omit<ApplicationDetailView, 'autoRejectedBy'>;
  const autoRejected = detail.events.find((event) => event.type === 'auto_rejected');
  return {
    id: detail.id,
    status: detail.status,
    submittedAt: detail.submittedAt,
    source: detail.source,
    stage: { id: detail.stage.id, name: detail.stage.name, kind: detail.stage.kind },
    candidate: { name: detail.candidate.name, email: detail.candidate.email, phone: detail.candidate.phone },
    fields: detail.fields,
    answers: detail.answers,
    autoRejectedBy: autoRejected ? (autoRejected.data as { fieldKey: string; fieldLabel: string }) : null,
    events: detail.events.map(({ id, type, fromStageId, toStageId, actorId, data, createdAt }) => ({
      id,
      type,
      fromStageId,
      toStageId,
      actorId,
      data,
      createdAt,
    })),
    notes: detail.notes.map(({ id, body, authorId, authorName, createdAt }) => ({
      id,
      body,
      authorId,
      authorName,
      createdAt,
    })),
  };
}
