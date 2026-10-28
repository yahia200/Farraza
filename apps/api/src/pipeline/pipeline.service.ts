import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import {
  checkRatingCriteria,
  formatHighlightText,
  highlightableQuestions,
  previewKindOf,
  summariseRatings,
  type RatingCriteriaScores,
} from '@repo/shared';
import { isUniqueViolation } from '../common/db-errors.js';
import type { Membership } from '../companies/company.js';
import type { JobWithStages } from '../jobs/job.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { User } from '../users/user.js';
import { ApplicationPolicy } from './application.policy.js';
import type { CreateNoteDto } from './dto/create-note.dto.js';
import type { MoveApplicationDto } from './dto/move-application.dto.js';
import type { SaveRatingDto } from './dto/save-rating.dto.js';
import { StorageService } from '../storage/storage.service.js';
import { DOWNLOAD_URL_TTL_SECONDS } from '../storage/storage.js';
import { FormsRepository } from '../forms/forms.repository.js';
import type { ApplicationCard, ApplicationDetail, BoardColumn, FileLink, HighlightedQuestion, SavedRating } from './pipeline.js';
import { PipelineRepository } from './pipeline.repository.js';

/**
 * The Criteria scores to store after a save: start from the Member's existing scores, drop each
 * Criterion the request sends as `null` (clear), set each number, and leave every other key alone.
 * That last part is how a score for a Criterion the Job no longer uses survives a re-rate (the
 * request can only address the Job's current Criteria). Nothing stored is ever `null`.
 */
function mergeCriteria(existing: Record<string, number>, requested: RatingCriteriaScores): Record<string, number> {
  const merged = { ...existing };
  for (const [key, score] of Object.entries(requested)) {
    if (score === null || score === undefined) delete merged[key];
    else merged[key] = score;
  }
  return merged;
}

/** What the detail calls a Rating's author once their user is gone (`ratings.user_id` is null). */
const FORMER_MEMBER_NAME = 'Former member';

@Injectable()
export class PipelineService {
  constructor(
    private readonly pipeline: PipelineRepository,
    private readonly jobs: JobsService,
    private readonly authorization: AuthorizationService,
    private readonly storage: StorageService,
    private readonly forms: FormsRepository,
  ) {}

  /**
   * A job's stages, each with its cards, plus the Job's Highlighted questions. Any member may read
   * it, interviewers included (the membership guard and the job lookup are the access check).
   */
  async board(membership: Membership, jobSlug: string) {
    const job = await this.jobs.get(membership, jobSlug);
    const highlightedQuestions = await this.highlightedQuestionsOf(job.id, job.highlightedQuestionKeys);
    const rows = await this.cardsOf(membership.company.id, job.id, highlightedQuestions);
    const cards = await this.withRatings(membership.company.id, rows);

    const columns: BoardColumn[] = job.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      position: stage.position,
      kind: stage.kind,
      applications: cards.filter((card) => card.stageId === stage.id),
    }));

    return {
      job: { title: job.title, slug: job.slug, status: job.status },
      columns,
      highlightedQuestions,
    };
  }

  /**
   * The stored keys that the latest published form still has as highlightable Questions, in that
   * form's order, with its current text. Stale keys are dropped here on every read, not at publish.
   */
  private async highlightedQuestionsOf(
    jobId: string,
    keys: readonly string[],
  ): Promise<HighlightedQuestion[]> {
    if (keys.length === 0) return [];
    const latest = await this.forms.findLatestPublished(jobId);
    if (!latest) return [];
    return highlightableQuestions(latest.fields)
      .filter((question) => keys.includes(question.key))
      .map((question) => ({ key: question.key, label: question.label }));
  }

  /**
   * The job's cards, each with its answer to every Highlighted question, resolved against the
   * Question of the same key in the Application's own form version (so an older Application shows
   * the option labels its applicant saw). With no Highlighted question, answers are not read.
   */
  private async cardsOf(
    companyId: string,
    jobId: string,
    highlighted: HighlightedQuestion[],
  ): Promise<Omit<ApplicationCard, 'rating'>[]> {
    if (highlighted.length === 0) {
      const rows = await this.pipeline.findCards(companyId, jobId);
      return rows.map((row) => ({ ...row, highlights: {} }));
    }

    const rows = await this.pipeline.findCardsWithAnswers(companyId, jobId);
    const versionIds = [...new Set(rows.map((row) => row.formVersionId))];
    const versions = await this.pipeline.findFormFields(companyId, jobId, versionIds);
    // Per version, its highlightable Questions by key: a key the version lacks, or has on a
    // Question that can't be highlighted there, reads as null.
    const questionsByVersion = new Map(
      [...versions].map(([id, fields]) => [
        id,
        new Map(highlightableQuestions(fields).map((question) => [question.key, question])),
      ]),
    );

    return rows.map(({ formVersionId, answers, ...row }) => {
      const questions = questionsByVersion.get(formVersionId);
      const highlights: Record<string, string | null> = {};
      for (const { key } of highlighted) {
        const question = questions?.get(key);
        highlights[key] = question ? formatHighlightText(question, answers[key]) : null;
      }
      return { ...row, highlights };
    });
  }

  /**
   * Adds each card's Average rating. One grouped query for the whole board, by the ids of the cards
   * just read (a Rating has no job id); none at all when the Job has no Applications. A card whose
   * Application has no Rating gets `{ average: null, count: 0 }`.
   */
  private async withRatings(
    companyId: string,
    cards: Omit<ApplicationCard, 'rating'>[],
  ): Promise<ApplicationCard[]> {
    if (cards.length === 0) return [];
    const summaries = await this.pipeline.findRatingSummaries(
      companyId,
      cards.map((card) => card.id),
    );
    return cards.map((card) => ({
      ...card,
      rating: summaries.get(card.id) ?? { average: null, count: 0 },
    }));
  }

  async detail(membership: Membership, jobSlug: string, applicationId: string): Promise<ApplicationDetail> {
    const job = await this.jobs.get(membership, jobSlug);
    const detail = await this.pipeline.findDetail(membership.company.id, job.id, applicationId);
    if (!detail) throw new NotFoundException();
    const { ratings: ratingRows, ...rest } = detail;
    const ratings = ratingRows.map((rating) => ({
      userId: rating.userId,
      name: rating.userName ?? FORMER_MEMBER_NAME,
      overall: rating.overall,
      criteria: rating.criteria,
      updatedAt: rating.updatedAt,
    }));
    return { ...rest, ratings, ratingSummary: summariseRatings(ratings) };
  }

  /**
   * The files an Application's applicant sent: the CV and the answers to file questions. Any member
   * may read them, interviewers included (same as `detail`: the membership guard and the job lookup
   * are the access check), so there is no policy call.
   */
  async listFiles(membership: Membership, jobSlug: string, applicationId: string) {
    const job = await this.jobs.get(membership, jobSlug);
    const files = await this.pipeline.findFiles(membership.company.id, job.id, applicationId);
    if (!files) throw new NotFoundException();
    return files;
  }

  /**
   * A short-lived link that downloads one file under the applicant's own file name. Opening a file
   * writes no history event. The link is minted per request and must never be cached.
   */
  async downloadLink(
    membership: Membership,
    jobSlug: string,
    applicationId: string,
    fileId: string,
  ): Promise<FileLink> {
    const job = await this.jobs.get(membership, jobSlug);
    const file = await this.pipeline.findFile(membership.company.id, job.id, applicationId, fileId);
    if (!file) throw new NotFoundException();

    const url = await this.storage.createDownloadUrl(file.storageKey, file.originalName);
    return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
  }

  /**
   * A short-lived link that shows one file in place (inline disposition, the stored content type
   * pinned). Same access and isolation as `downloadLink`, and likewise never cached. Only types the
   * candidate sheet renders get one (`previewKindOf`): an inline link for anything else could make
   * the bucket's origin render a hostile file as a page, so those answer 400 and the sheet offers
   * the download instead.
   */
  async viewLink(
    membership: Membership,
    jobSlug: string,
    applicationId: string,
    fileId: string,
  ): Promise<FileLink> {
    const job = await this.jobs.get(membership, jobSlug);
    const file = await this.pipeline.findFile(membership.company.id, job.id, applicationId, fileId);
    if (!file) throw new NotFoundException();
    if (!previewKindOf(file.mimeType)) {
      throw new BadRequestException('This file cannot be previewed. Download it instead.');
    }

    const url = await this.storage.createViewUrl(file.storageKey, file.originalName, file.mimeType);
    return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
  }

  /**
   * The Stage this Application is in now, from the Job's own stages. 404 if the Application isn't in
   * this company's Job (or, which cannot happen, sits in a Stage the Job doesn't have).
   */
  private async currentStageOf(membership: Membership, job: JobWithStages, applicationId: string) {
    const stageId = await this.pipeline.findStageOf(membership.company.id, job.id, applicationId);
    const stage = stageId ? job.stages.find((candidate) => candidate.id === stageId) : undefined;
    if (!stage) throw new NotFoundException();
    return stage;
  }

  async move(
    user: User,
    membership: Membership,
    jobSlug: string,
    applicationId: string,
    dto: MoveApplicationDto,
  ) {
    await this.authorization.authorize(ApplicationPolicy, 'move', user, membership);

    const job = await this.jobs.get(membership, jobSlug);
    const to = job.stages.find((stage) => stage.id === dto.stageId);
    if (!to) throw new BadRequestException('That stage is not part of this job.');

    const from = await this.currentStageOf(membership, job, applicationId);
    if (from.id === to.id) throw new ConflictException('The candidate is already in that stage.');

    const moved = await this.pipeline.move({
      companyId: membership.company.id,
      applicationId,
      actorId: user.id,
      from: { id: from.id, name: from.name },
      to: { id: to.id, name: to.name, kind: to.kind },
    });
    if (!moved) {
      throw new ConflictException('Someone else just moved this candidate. Reload and try again.');
    }

    return { id: applicationId, stageId: to.id, status: moved.status };
  }

  async addNote(
    user: User,
    membership: Membership,
    jobSlug: string,
    applicationId: string,
    dto: CreateNoteDto,
  ) {
    await this.authorization.authorize(ApplicationPolicy, 'addNote', user, membership);

    const job = await this.jobs.get(membership, jobSlug);
    const stageId = await this.pipeline.findStageOf(membership.company.id, job.id, applicationId);
    if (!stageId) throw new NotFoundException();

    return this.pipeline.addNote({
      companyId: membership.company.id,
      applicationId,
      author: { id: user.id, name: user.name },
      body: dto.body,
    });
  }

  /**
   * Gives or replaces the caller's own Rating on an Application (any status) and records a `rated`
   * event. The user is the session's, never the body's.
   */
  async rate(
    user: User,
    membership: Membership,
    jobSlug: string,
    applicationId: string,
    dto: SaveRatingDto,
  ): Promise<SavedRating> {
    await this.authorization.authorize(ApplicationPolicy, 'rate', user, membership);

    const job = await this.jobs.get(membership, jobSlug);
    const stage = await this.currentStageOf(membership, job, applicationId);

    const requested = dto.criteria ?? {};
    const checked = checkRatingCriteria(requested, job.ratingCriteria);
    if (!checked.ok) {
      throw new BadRequestException({
        message: 'Some criteria are not used for this job.',
        // The shared check reports the Criterion key; the validation pipe's errors are paths into the
        // body, so prefix these to give one path shape per route (as saveHighlightedQuestions does).
        errors: checked.errors.map((error) => ({ ...error, path: `criteria.${error.path}` })),
      });
    }

    try {
      return await this.pipeline.saveRating({
        companyId: membership.company.id,
        applicationId,
        userId: user.id,
        stageName: stage.name,
        resolve: (previous) => ({
          overall: dto.overall,
          criteria: mergeCriteria(previous?.criteria ?? {}, requested),
        }),
      });
    } catch (error) {
      // The save is an upsert (`ON CONFLICT`), so the (application, user) key cannot clash with
      // itself; this guards any other unique constraint the table may gain, in the repo's usual way.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Your rating was just saved from somewhere else. Try again.');
      }
      throw error;
    }
  }
}