import 'server-only';
import { notFound, redirect } from 'next/navigation';
import type {
  ActivityEvent,
  ActivityNote,
  Answers,
  ApplicationStatus,
  CvMode,
  FilePurpose,
  FormFields,
} from '@repo/shared';
import { apiFetch } from './api';
import { formatDate } from './format';

/**
 * Data Access Layer: the one place that resolves "who is signed in".
 * Pattern: node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md (Step 1)
 */

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  /** Whether they opened the link emailed at sign-up (the dashboard reminds them until then). */
  emailVerified: boolean;
}



/**
 * The signed-in user, or a redirect to /sign-in.
 * `use cache: private` may read cookies and keeps the result in the browser
 * only. Callers must render inside a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  'use cache: private';

  const user = await fetchCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }
  return user;
}

/**
 * The signed-in user, or null for a signed-out visitor: for public pages that
 * only adapt to who is viewing (such as /verify-email). Same private cache and
 * <Suspense> rule as getCurrentUser().
 */
export async function getCurrentUserOrNull(): Promise<CurrentUser | null> {
  'use cache: private';

  return fetchCurrentUser();
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const response = await apiFetch('/api/users/me');
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Could not load the current user (HTTP ${response.status}).`);
  }

  const user = (await response.json()) as CurrentUser;
  // Expose only what the UI needs.
  return { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified };
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
  cvMode: CvMode;
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
    v && { version: v.version, fields: v.fields, cvMode: v.cvMode, publishedAt: v.publishedAt, updatedAt: v.updatedAt };
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

/** One application in a job's list, with the stage it's in. */
export interface ApplicationSummary {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  candidate: { name: string; email: string };
  stage: JobStage;
}

/**
 * One card on the pipeline board: an application without its stage (the column
 * is the stage), plus the applied date already formatted on the server
 * (lib/format.ts). The card is a client component, so it renders this string
 * rather than formatting `submittedAt` itself.
 */
export type PipelineCard = Omit<ApplicationSummary, 'stage'> & { appliedLabel: string };

/** Mirrors BoardColumn in apps/api/src/pipeline/pipeline.ts: a stage and the applications in it. */
export interface PipelineColumn extends JobStage {
  applications: PipelineCard[];
}

/**
 * A job's pipeline board: its stages in order, each with its applications.
 * The API answers with this shape; the table and the board views both render
 * from this one fetch (the table flattens it with `flattenBoard`).
 */
export async function getPipelineBoard(companySlug: string, jobSlug: string): Promise<PipelineColumn[]> {
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
  const board = (await response.json()) as { columns: PipelineColumn[] };
  // Expose only what the UI needs.
  return board.columns
    .map(({ id, name, position, kind, applications }) => ({
      id,
      name,
      position,
      kind,
      applications: applications.map(({ id: applicationId, status, submittedAt, candidate }) => ({
        id: applicationId,
        status,
        submittedAt,
        appliedLabel: formatDate(submittedAt),
        candidate: { name: candidate.name, email: candidate.email },
      })),
    }))
    .sort((a, b) => a.position - b.position);
}

/** The board as one row per application, for the table view. */
export function flattenBoard(columns: PipelineColumn[]): (ApplicationSummary & { appliedLabel: string })[] {
  return columns.flatMap(({ applications, ...stage }) => applications.map((card) => ({ ...card, stage })));
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
  /** That version's CV setting: whether the applicant was asked for a CV. */
  cvMode: CvMode;
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
    cvMode: detail.cvMode,
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

/** Mirrors ApplicationFile in apps/api/src/pipeline/pipeline.ts. No storage key, no link. */
export interface ApplicationFileView {
  id: string;
  /** `cv` for the CV slot, `answer` for the answer to the file question `fieldKey`. */
  purpose: FilePurpose;
  fieldKey: string | null;
  /** The applicant's own name for the file (untrusted text). */
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  /** What the browser declared for video and audio. */
  durationSeconds: number | null;
}

/**
 * The files an application's applicant sent (GET .../applications/:id/files). Cached like the
 * rest of the detail because a submitted application's files never change, but it holds
 * metadata only: a download link lasts minutes, so it is minted per click by the
 * `getFileDownloadUrl` action and must never be created in a cached function. Throws when the
 * files can't be loaded, so a failure isn't cached; the caller decides how to show it.
 */
export async function getApplicationFiles(
  companySlug: string,
  jobSlug: string,
  applicationId: string,
): Promise<ApplicationFileView[]> {
  'use cache: private';

  const response = await apiFetch(
    `${jobsPath(companySlug, jobSlug)}/applications/${encodeURIComponent(applicationId)}/files`,
  );
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    throw new Error(`Could not load the application's files (HTTP ${response.status}).`);
  }
  const files = (await response.json()) as ApplicationFileView[];
  return files.map(({ id, purpose, fieldKey, originalName, mimeType, sizeBytes, durationSeconds }) => ({
    id,
    purpose,
    fieldKey,
    originalName,
    mimeType,
    sizeBytes,
    durationSeconds,
  }));
}
