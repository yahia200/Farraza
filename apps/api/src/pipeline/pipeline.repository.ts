import { Injectable } from '@nestjs/common';
import type { Answers, FilePurpose, FormFields } from '@repo/shared';
import type { StageKind } from '../jobs/job.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ApplicationDetailRow,
  CardRow,
  CardRowWithAnswers,
  ApplicationFile,
  ApplicationStatus,
  DownloadableFile,
  NoteView,
  RatingValues,
  SavedRating,
} from './pipeline.js';
import { EVENT_FOR_STAGE, STATUS_FOR_STAGE } from './pipeline.js';

function toApplicationFile(row: {
  id: string;
  purpose: FilePurpose;
  fieldKey: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
}): ApplicationFile {
  return {
    id: row.id,
    purpose: row.purpose,
    fieldKey: row.fieldKey,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    durationSeconds: row.durationSeconds,
  };
}

/**
 * `criteria` is CHECKed to be an object and written only from the service's merge of a parsed
 * `saveRatingSchema` body (catalog keys to 1-5, never `null`), so the cast is as safe as the one for
 * `highlightedQuestionKeys`.
 */
function toRatingValues(row: { overall: number; criteria: unknown }): RatingValues {
  return { overall: row.overall, criteria: row.criteria as RatingValues['criteria'] };
}

function toCardRow(row: {
  id: string;
  stageId: string;
  status: ApplicationStatus;
  submittedAt: Date;
  email: string;
  phone: string;
  candidate: { name: string };
}): CardRow {
  return {
    id: row.id,
    stageId: row.stageId,
    status: row.status,
    submittedAt: row.submittedAt,
    // The email and phone this application was sent with (the candidate row keeps the latest).
    candidate: { name: row.candidate.name, email: row.email, phone: row.phone },
  };
}

@Injectable()
export class PipelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get applications() {
    return this.prisma.db.orm.public.Application;
  }

  private get events() {
    return this.prisma.db.orm.public.ApplicationEvent;
  }

  private get ratings() {
    return this.prisma.db.orm.public.Rating;
  }

  private get notes() {
    return this.prisma.db.orm.public.Note;
  }

  private get ratings() {
    return this.prisma.db.orm.public.Rating;
  }

  private get formVersions() {
    return this.prisma.db.orm.public.FormVersion;
  }

  /**
   * A job's cards, newest first. Only the card's own columns are read (`select`), never `answers`:
   * the board reads those through `findCardsWithAnswers`, and only when the Job has Highlighted
   * questions.
   */
  async findCards(companyId: string, jobId: string): Promise<CardRow[]> {
    const rows = await this.applications
      .select('id', 'stageId', 'status', 'submittedAt', 'email', 'phone')
      .where({ companyId, jobId })
      .include('candidate')
      .orderBy((application) => application.submittedAt.desc())
      .all();

    return rows.map(toCardRow);
  }

  /**
   * A job's cards, newest first, with each Application's answers and the id of the form version
   * they answer. The versions themselves are not joined (`include('formVersion')` would repeat a
   * version's whole `fields` on every row); `findFormFields` reads each distinct one once.
   */
  async findCardsWithAnswers(companyId: string, jobId: string): Promise<CardRowWithAnswers[]> {
    const rows = await this.applications
      .select('id', 'stageId', 'status', 'submittedAt', 'email', 'phone', 'formVersionId', 'answers')
      .where({ companyId, jobId })
      .include('candidate')
      .orderBy((application) => application.submittedAt.desc())
      .all();

    return rows.map((row) => ({
      ...toCardRow(row),
      formVersionId: row.formVersionId,
      answers: row.answers as Answers,
    }));
  }

  /**
   * The Average rating of each of these Applications of one company, by Application id, in one
   * grouped query (`GROUP BY application_id`). An Application with no Rating has no entry. `count`
   * is the number of Ratings (a Rating whose author left still counts, as in `summariseRatings`),
   * and `average` the plain mean of `overall`, never rounded.
   */
  async findRatingSummaries(
    companyId: string,
    applicationIds: readonly string[],
  ): Promise<Map<string, { count: number; average: number }>> {
    if (applicationIds.length === 0) return new Map();
    const rows = await this.ratings
      .where({ companyId })
      .where((rating) => rating.applicationId.in(applicationIds))
      .groupBy('applicationId')
      .aggregate((aggregate) => ({
        count: aggregate.count(),
        average: aggregate.avg('overall'),
      }));

    // `avg` is nullable in the types because an empty group has none; a group here has a row.
    return new Map(
      rows.map((row) => [row.applicationId, { count: row.count, average: row.average ?? 0 }]),
    );
  }

  /**
   * The `fields` of each of these form versions of this company's job, by version id. Unknown ids,
   * and ids of another job's or company's versions, are left out.
   */
  async findFormFields(
    companyId: string,
    jobId: string,
    versionIds: readonly string[],
  ): Promise<Map<string, FormFields>> {
    if (versionIds.length === 0) return new Map();
    const rows = await this.formVersions
      .select('id', 'fields')
      .where({ companyId, jobId })
      .where((version) => version.id.in(versionIds))
      .all();
    return new Map(rows.map((row) => [row.id, row.fields as FormFields]));
  }

  /** The application's current stage, or null if it isn't in this job. */
  async findStageOf(companyId: string, jobId: string, applicationId: string): Promise<string | null> {
    const row = await this.applications.where({ id: applicationId, companyId, jobId }).first();
    return row ? row.stageId : null;
  }

  async findDetail(
    companyId: string,
    jobId: string,
    applicationId: string,
  ): Promise<ApplicationDetailRow | null> {
    const row = await this.applications
      .where({ id: applicationId, companyId, jobId })
      .include('candidate')
      .include('formVersion')
      .include('stage')
      .first();
    if (!row) return null;

    const [eventRows, noteRows, ratingRows] = await Promise.all([
      this.events
        .where({ applicationId })
        .orderBy((event) => event.createdAt.asc())
        .all(),
      this.notes
        .where({ applicationId })
        .include('author')
        .orderBy((note) => note.createdAt.asc())
        .all(),
      // One query for every Member's Rating with the author's name (the `user` relation is null once the
      // user is gone: `user_id` is SET NULL). The Application above is already this company's and Job's.
      this.ratings
        .where({ companyId, applicationId })
        .include('user')
        .orderBy((rating) => rating.createdAt.asc())
        .all(),
    ]);

    return {
      id: row.id,
      status: row.status,
      submittedAt: row.submittedAt,
      source: row.source,
      stage: { id: row.stage.id, name: row.stage.name, kind: row.stage.kind },
      candidate: {
        id: row.candidate.id,
        name: row.candidate.name,
        // The contact details this application was sent with.
        email: row.email,
        phone: row.phone,
      },
      fields: row.formVersion.fields as FormFields,
      cvMode: row.formVersion.cvMode,
      answers: row.answers as Answers,
      events: eventRows.map((event) => ({
        id: event.id,
        type: event.type,
        fromStageId: event.fromStageId,
        toStageId: event.toStageId,
        actorId: event.actorId,
        data: event.data,
        createdAt: event.createdAt,
      })),
      notes: noteRows.map((note) => ({
        id: note.id,
        body: note.body,
        authorId: note.authorId,
        authorName: note.author?.name ?? null,
        createdAt: note.createdAt,
      })),
      ratings: ratingRows.map((rating) => ({
        userId: rating.userId,
        userName: rating.user?.name ?? null,
        ...toRatingValues(rating),
        createdAt: rating.createdAt,
        updatedAt: rating.updatedAt,
      })),
    };
  }

  private get files() {
    return this.prisma.db.orm.public.File;
  }

  /**
   * The files attached to an Application, oldest first, or null if the Application isn't in this
   * company's job. Pending files have no Application, so they never appear.
   */
  async findFiles(
    companyId: string,
    jobId: string,
    applicationId: string,
  ): Promise<ApplicationFile[] | null> {
    const application = await this.applications.where({ id: applicationId, companyId, jobId }).first();
    if (!application) return null;

    const rows = await this.files
      .where({ companyId, jobId, applicationId, status: 'uploaded' })
      .orderBy((file) => file.createdAt.asc())
      .all();
    return rows.map(toApplicationFile);
  }

  /** One uploaded file of this Application, or null if it isn't that company's, job's and Application's. */
  async findFile(
    companyId: string,
    jobId: string,
    applicationId: string,
    fileId: string,
  ): Promise<DownloadableFile | null> {
    const row = await this.files
      .where({ id: fileId, companyId, jobId, applicationId, status: 'uploaded' })
      .first();
    return row ? { ...toApplicationFile(row), storageKey: row.storageKey } : null;
  }

  /** Returns null if the application is no longer in `from`. */
  async move(input: {
    companyId: string;
    applicationId: string;
    actorId: string;
    from: { id: string; name: string };
    to: { id: string; name: string; kind: StageKind };
  }): Promise<{ status: ApplicationStatus } | null> {
    const status = STATUS_FOR_STAGE[input.to.kind];

    return this.prisma.db.transaction(async (tx) => {
      const updated = await tx.orm.public.Application
        .where({ id: input.applicationId, stageId: input.from.id })
        .update({ stageId: input.to.id, status });
      if (!updated) return null;

      await tx.orm.public.ApplicationEvent.create({
        companyId: input.companyId,
        applicationId: input.applicationId,
        type: EVENT_FOR_STAGE[input.to.kind],
        fromStageId: input.from.id,
        toStageId: input.to.id,
        actorId: input.actorId,
        data: { fromStageName: input.from.name, toStageName: input.to.name },
      });

      return { status };
    });
  }

  /**
   * Gives or replaces one Member's Rating and appends the `rated` event, in one transaction.
   * `resolve` gets the Member's current Rating as read inside the transaction (`null` on a first
   * rating) and returns the values to store, so the service owns the rules (carrying over dropped
   * Criteria) while the read and the write cannot be separated by another save. The event's `previous`
   * is that same read. This is last-write-wins by design (spec, "Confirmed details" 2): no condition
   * on `updated_at`, so two tabs of one Member saving at once can record a slightly wrong `previous`.
   */
  async saveRating(input: {
    companyId: string;
    applicationId: string;
    userId: string;
    stageName: string;
    resolve: (previous: RatingValues | null) => RatingValues;
  }): Promise<SavedRating> {
    return this.prisma.db.transaction(async (tx) => {
      const existing = await tx.orm.public.Rating
        .where({ applicationId: input.applicationId, userId: input.userId })
        .first();
      const previous = existing ? toRatingValues(existing) : null;
      const current = input.resolve(previous);

      // `update` is non-empty, so the ORM also sets `updated_at` on the update branch
      // (`applyUpdateDefaults` in orm-client.mjs only runs when `update` has values).
      const saved = await tx.orm.public.Rating.upsert({
        create: {
          companyId: input.companyId,
          applicationId: input.applicationId,
          userId: input.userId,
          overall: current.overall,
          criteria: current.criteria,
        },
        update: { overall: current.overall, criteria: current.criteria },
        conflictOn: { applicationId: input.applicationId, userId: input.userId },
      });

      await tx.orm.public.ApplicationEvent.create({
        companyId: input.companyId,
        applicationId: input.applicationId,
        type: 'rated',
        actorId: input.userId,
        data: { previous, current, stage: input.stageName },
      });

      return { ...toRatingValues(saved), updatedAt: saved.updatedAt };
    });
  }

  async addNote(input: {
    companyId: string;
    applicationId: string;
    author: { id: string; name: string };
    body: string;
  }): Promise<NoteView> {
    return this.prisma.db.transaction(async (tx) => {
      const note = await tx.orm.public.Note.create({
        companyId: input.companyId,
        applicationId: input.applicationId,
        authorId: input.author.id,
        body: input.body,
      });

      await tx.orm.public.ApplicationEvent.create({
        companyId: input.companyId,
        applicationId: input.applicationId,
        type: 'note_added',
        actorId: input.author.id,
        data: { noteId: note.id },
      });

      return {
        id: note.id,
        body: note.body,
        authorId: input.author.id,
        authorName: input.author.name,
        createdAt: note.createdAt,
      };
    });
  }
}