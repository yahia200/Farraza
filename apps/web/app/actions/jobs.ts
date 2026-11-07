'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  createJobSchema,
  RELOAD_MESSAGE,
  saveHighlightedQuestionsSchema,
  saveRatingCriteriaSchema,
  saveRequirementsSchema,
  parseRecheckStatus,
  type RecheckPoll,
  type RecheckStatus,
  groupRequirementErrors,
  requirementErrorsFromIssues,
  type Requirement,
  type RequirementErrors,
  updateJobSchema,
  groupRuleErrors,
  type CreateJobInput,
  type RuleErrors,
  type ScreeningRule,
  type UpdateJobInput,
} from '@repo/shared';
import { GENERIC_FAILURE_MESSAGE, type ActionFailure } from '@/lib/action-failure';
import { apiFetch, failureFromResponse, readApiError } from '@/lib/api';
import { expireCompanyJobs, expirePublicJob } from '@/lib/public-jobs';

/**
 * Jobs Server Actions, calling apps/api/src/jobs. Each re-validates with the
 * shared schemas and calls revalidatePath so the cached job lists (lib/dal.ts) refresh.
 */

const jobsPath = (companySlug: string, jobSlug?: string, action?: 'open' | 'close') =>
  `/api/companies/${encodeURIComponent(companySlug)}/jobs` +
  (jobSlug ? `/${encodeURIComponent(jobSlug)}` : '') +
  (action ? `/${action}` : '');

const JOB_FIELDS = ['title', 'description'] as const;
type JobField = (typeof JOB_FIELDS)[number];

const NO_PERMISSION = { 403: () => ({ formError: "You don't have permission to change jobs." }) };

/** The form sends "" for an empty description; the API stores null. */
const descriptionOrNull = (description: string | null | undefined) => description?.trim() || null;

export type CreateJobResult = ActionFailure<JobField> & { slug?: string };

/** Creates a draft job (with the default stages) and returns its slug. */
export async function createJob(companySlug: string, input: CreateJobInput): Promise<CreateJobResult> {
  const parsed = createJobSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch(jobsPath(companySlug), {
    method: 'POST',
    body: JSON.stringify({ title: parsed.data.title, description: descriptionOrNull(parsed.data.description) }),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    // 409: two jobs got the same address at the same moment.
    return failureFromResponse(response, JOB_FIELDS, { ...NO_PERMISSION, 409: (message) => ({ formError: message }) });
  }

  const { slug } = (await response.json()) as { slug: string };
  revalidatePath('/', 'layout');
  return { slug };
}

export type UpdateJobResult = ActionFailure<JobField> & { saved?: boolean };

export async function updateJob(companySlug: string, jobSlug: string, input: UpdateJobInput): Promise<UpdateJobResult> {
  const parsed = updateJobSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch(jobsPath(companySlug, jobSlug), {
    method: 'PATCH',
    body: JSON.stringify({ title: parsed.data.title, description: descriptionOrNull(parsed.data.description) }),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, JOB_FIELDS, NO_PERMISSION);
  }

  revalidatePath('/', 'layout');
  // The public apply page and the company listing both show title/description.
  expirePublicJob(companySlug, jobSlug);
  expireCompanyJobs(companySlug);
  return { saved: true };
}

export type JobStatusResult = ActionFailure<never> & { ok?: boolean };

/** Opens (or reopens) a job. The API refuses until a form is published (409). */
export async function openJob(companySlug: string, jobSlug: string): Promise<JobStatusResult> {
  return changeStatus(companySlug, jobSlug, 'open');
}

export async function closeJob(companySlug: string, jobSlug: string): Promise<JobStatusResult> {
  return changeStatus(companySlug, jobSlug, 'close');
}

async function changeStatus(companySlug: string, jobSlug: string, action: 'open' | 'close'): Promise<JobStatusResult> {
  const response = await apiFetch(jobsPath(companySlug, jobSlug, action), { method: 'POST' });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    // 409 carries the reason: no published form, already open, or not open.
    return failureFromResponse(response, [], { ...NO_PERMISSION, 409: (message) => ({ formError: message }) });
  }
  revalidatePath('/', 'layout');
  // Opening or closing decides whether the apply page exists and whether the
  // job shows in the company listing.
  expirePublicJob(companySlug, jobSlug);
  expireCompanyJobs(companySlug);
  return { ok: true };
}

export type SaveHighlightedQuestionsResult = ActionFailure<never> & { keys?: string[] };

/**
 * Saves the Job's Highlighted questions, calling
 * PUT .../jobs/:jobSlug/highlighted-questions with the whole new list
 * (apps/api/src/jobs). The picker on the candidates page calls it on every
 * tick, so it returns failures rather than throwing. It revalidates the
 * candidates page, which re-reads the job (the saved keys) and the board (the
 * answers shown), so the list updates without a reload. Applicants never see
 * this choice, so the public job is left alone.
 */
export async function saveHighlightedQuestions(
  companySlug: string,
  jobSlug: string,
  keys: string[],
): Promise<SaveHighlightedQuestionsResult> {
  const parsed = saveHighlightedQuestionsSchema.safeParse({ keys });
  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? RELOAD_MESSAGE };
  }

  const candidatesPath = `/dashboard/${companySlug}/jobs/${jobSlug}/candidates`;
  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/highlighted-questions`, {
    method: 'PUT',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    // 400: a key is no longer on the published form (its message says so); 409: no published form.
    const failure = await failureFromResponse(response, [], {
      ...NO_PERMISSION,
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
      409: (message) => ({ formError: message }),
    });
    if (response.status === 400 || response.status === 409) {
      // The picker was built from an older form: refresh it so it lists what the form asks now.
      revalidatePath(candidatesPath);
    }
    return failure;
  }

  const saved = (await response.json()) as { keys: string[] };
  revalidatePath(candidatesPath);
  return { keys: saved.keys };
}

export type SaveRatingCriteriaResult = ActionFailure<never> & { keys?: string[] };

/**
 * Saves the Job's rating Criteria, calling PUT .../jobs/:jobSlug/rating-criteria
 * with the whole new list (apps/api/src/jobs). The picker on the candidates
 * page calls it on every tick, so it returns failures rather than throwing.
 * It revalidates the candidates page, which re-reads the job (the saved keys),
 * so the sheet's Criteria rows follow without a reload, and the Settings page, where the Criteria
 * are chosen. Applicants never see Criteria, so the public job is left alone.
 */
export async function saveRatingCriteria(
  companySlug: string,
  jobSlug: string,
  keys: string[],
): Promise<SaveRatingCriteriaResult> {
  const parsed = saveRatingCriteriaSchema.safeParse({ keys });
  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? RELOAD_MESSAGE };
  }

  const candidatesPath = `/dashboard/${companySlug}/jobs/${jobSlug}/candidates`;
  const settingsPath = `/dashboard/${companySlug}/jobs/${jobSlug}/settings`;
  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/rating-criteria`, {
    method: 'PUT',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    // 400 can only come from a stale page or a hand-made request: the catalog is fixed and checked above.
    const failure = await failureFromResponse(response, [], {
      ...NO_PERMISSION,
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
    });
    if (response.status === 400) {
      revalidatePath(candidatesPath);
      revalidatePath(settingsPath);
    }
    return failure;
  }

  const saved = (await response.json()) as { keys: string[] };
  revalidatePath(candidatesPath);
  revalidatePath(settingsPath);
  return { keys: saved.keys };
}

export type SaveScreeningRulesResult = ActionFailure<never> & {
  /** The API's refusals, by rule index (`groupRuleErrors`). Present with a 400 that names rules. */
  ruleErrors?: Record<number, RuleErrors>;
  rules?: ScreeningRule[];
};

/**
 * Saves the Job's Screening rules, calling PUT .../jobs/:jobSlug/screening-rules with the whole new
 * list (apps/api/src/jobs: one replace-all, last write wins). The body is not re-validated here: the
 * rules are checked against the published form, which only the API reads, and its 400 comes back as
 * field errors per rule (`rules.<index>.<path>`), which the editor shows on the right rule. Returns
 * failures rather than throwing. Revalidates the Settings page, which re-reads the job, and the
 * candidates page, which will show flags. Applicants never see rules, so the public job is left alone.
 */
export async function saveScreeningRules(
  companySlug: string,
  jobSlug: string,
  rules: ScreeningRule[],
): Promise<SaveScreeningRulesResult> {
  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/screening-rules`, {
    method: 'PUT',
    body: JSON.stringify({ rules }),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  const settingsPath = `/dashboard/${companySlug}/jobs/${jobSlug}/settings`;
  if (!response.ok) {
    if (response.status === 400) {
      const body = await readApiError(response);
      const { byRule, form } = groupRuleErrors(body.errors ?? []);
      // The form was probably published or changed under an open page: refresh what the editor offers.
      revalidatePath(settingsPath);
      const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
      return {
        ruleErrors: byRule,
        formError: form[0] ?? (Object.keys(byRule).length > 0 ? undefined : message),
      };
    }
    return failureFromResponse(response, [], {
      ...NO_PERMISSION,
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
    });
  }

  const saved = (await response.json()) as { rules: ScreeningRule[] };
  revalidatePath(settingsPath);
  revalidatePath(`/dashboard/${companySlug}/jobs/${jobSlug}/candidates`);
  return { rules: saved.rules };
}

export type SaveRequirementsResult = ActionFailure<never> & {
  /** Refusals by Requirement index (`groupRequirementErrors`), from the shared validator or the API's 400. */
  requirementErrors?: Record<number, RequirementErrors>;
  requirements?: Requirement[];
  version?: number;
};

/**
 * Saves the Job's Requirements, calling PUT .../jobs/:jobSlug/requirements with the whole new list
 * (apps/api/src/jobs; answers `{ requirements, version }`). Unlike the Screening rules there is no form
 * to check against, so the body is validated here with `saveRequirementsSchema` (the API's own schema)
 * and its messages are shown on the Requirement they are about. An unchanged list creates no version
 * (the API answers the stored list and version). Returns failures rather than throwing. Revalidates the
 * Settings page, which re-reads the job. Applicants never see Requirements, so the public job is left alone.
 */
export async function saveRequirements(
  companySlug: string,
  jobSlug: string,
  requirements: Requirement[],
): Promise<SaveRequirementsResult> {
  const settingsPath = `/dashboard/${companySlug}/jobs/${jobSlug}/settings`;
  const parsed = saveRequirementsSchema.safeParse({ requirements });
  if (!parsed.success) {
    const { byRequirement, form } = groupRequirementErrors(requirementErrorsFromIssues(parsed.error.issues));
    return { requirementErrors: byRequirement, formError: form[0] };
  }

  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/requirements`, {
    method: 'PUT',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    if (response.status === 409) {
      // Someone saved at the same moment: show the newer list.
      revalidatePath(settingsPath);
    }
    return failureFromResponse(response, [], {
      ...NO_PERMISSION,
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
      409: (message) => ({ formError: message }),
    });
  }

  const saved = (await response.json()) as { requirements: Requirement[]; version: number };
  revalidatePath(settingsPath);
  return { requirements: saved.requirements, version: saved.version };
}

export type RecheckCountResult = ActionFailure<never> & { count?: number };
export type StartRecheckResult = ActionFailure<never> & { status?: RecheckStatus };

const recheckPath = (companySlug: string, jobSlug: string) => `${jobsPath(companySlug, jobSlug)}/recheck`;

/**
 * How many Applications a Re-check would touch (GET .../jobs/:jobSlug/recheck, `{ count }`; 0 when the
 * Job has no Requirements version). Open to any member. Returns failures instead of throwing.
 */
export async function getRecheckCount(companySlug: string, jobSlug: string): Promise<RecheckCountResult> {
  const response = await apiFetch(recheckPath(companySlug, jobSlug));
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, [], {
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
    });
  }
  const body = (await response.json()) as { count?: unknown };
  return typeof body.count === 'number' ? { count: body.count } : { formError: GENERIC_FAILURE_MESSAGE };
}

/**
 * Starts a Re-check (POST .../jobs/:jobSlug/recheck, 202 with the status). The API makes this a no-op
 * while a run is waiting or active and queues nothing at a count of zero, so a repeat call is harmless.
 * Needs the permission that saves Requirements (interviewers get 403). No page revalidation: the results
 * change nothing the Settings page renders; the board and list read them on their next load.
 */
export async function startRecheck(companySlug: string, jobSlug: string): Promise<StartRecheckResult> {
  const response = await apiFetch(recheckPath(companySlug, jobSlug), { method: 'POST' });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, [], {
      ...NO_PERMISSION,
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
    });
  }
  const status = parseRecheckStatus(await response.json());
  return status ? { status } : { formError: GENERIC_FAILURE_MESSAGE };
}

/**
 * The Re-check's progress (GET .../jobs/:jobSlug/recheck/status), polled by the Settings tab through this
 * action because the browser never calls the API. Failures come back as `{ ok: false, message }`, which
 * ends the polling (`nextPoll` in @repo/shared).
 */
export async function getRecheckStatus(companySlug: string, jobSlug: string): Promise<RecheckPoll> {
  const response = await apiFetch(`${recheckPath(companySlug, jobSlug)}/status`);
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    const failure = await failureFromResponse(response, [], {
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
    });
    return { ok: false, message: failure.formError ?? GENERIC_FAILURE_MESSAGE };
  }
  const status = parseRecheckStatus(await response.json());
  return status ? { ok: true, status } : { ok: false, message: GENERIC_FAILURE_MESSAGE };
}
