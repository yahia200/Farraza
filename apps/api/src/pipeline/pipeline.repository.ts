import { Injectable } from '@nestjs/common';
import type { Answers, FilePurpose, FormFields } from '@repo/shared';
import type { StageKind } from '../jobs/job.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ApplicationCard,
  ApplicationDetail,
  ApplicationFile,
  ApplicationStatus,
  DownloadableFile,
  NoteView,
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

@Injectable()
export class PipelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get applications() {
    return this.prisma.db.orm.public.Application;
  }

  private get events() {
    return this.prisma.db.orm.public.ApplicationEvent;
  }

  private get notes() {
    return this.prisma.db.orm.public.Note;
  }

  async findCards(jobId: string): Promise<ApplicationCard[]> {
    const rows = await this.applications
      .where({ jobId })
      .include('candidate')
      .orderBy((application) => application.submittedAt.desc())
      .all();

    return rows.map((row) => ({
      id: row.id,
      stageId: row.stageId,
      status: row.status,
      submittedAt: row.submittedAt,
      // The email this application was sent with (the candidate row keeps the latest).
      candidate: { name: row.candidate.name, email: row.email },
    }));
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
  ): Promise<ApplicationDetail | null> {
    const row = await this.applications
      .where({ id: applicationId, companyId, jobId })
      .include('candidate')
      .include('formVersion')
      .include('stage')
      .first();
    if (!row) return null;

    const [eventRows, noteRows] = await Promise.all([
      this.events
        .where({ applicationId })
        .orderBy((event) => event.createdAt.asc())
        .all(),
      this.notes
        .where({ applicationId })
        .include('author')
        .orderBy((note) => note.createdAt.asc())
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