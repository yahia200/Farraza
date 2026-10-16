import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { previewKindOf } from '@repo/shared';
import type { Membership } from '../companies/company.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { User } from '../users/user.js';
import { ApplicationPolicy } from './application.policy.js';
import type { CreateNoteDto } from './dto/create-note.dto.js';
import type { MoveApplicationDto } from './dto/move-application.dto.js';
import { StorageService } from '../storage/storage.service.js';
import { DOWNLOAD_URL_TTL_SECONDS } from '../storage/storage.js';
import type { BoardColumn, FileLink } from './pipeline.js';
import { PipelineRepository } from './pipeline.repository.js';

@Injectable()
export class PipelineService {
  constructor(
    private readonly pipeline: PipelineRepository,
    private readonly jobs: JobsService,
    private readonly authorization: AuthorizationService,
    private readonly storage: StorageService,
  ) {}

  async board(membership: Membership, jobSlug: string) {
    const job = await this.jobs.get(membership, jobSlug);
    const cards = await this.pipeline.findCards(job.id);

    const columns: BoardColumn[] = job.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      position: stage.position,
      kind: stage.kind,
      applications: cards.filter((card) => card.stageId === stage.id),
    }));

    return { job: { title: job.title, slug: job.slug, status: job.status }, columns };
  }

  async detail(membership: Membership, jobSlug: string, applicationId: string) {
    const job = await this.jobs.get(membership, jobSlug);
    const detail = await this.pipeline.findDetail(membership.company.id, job.id, applicationId);
    if (!detail) throw new NotFoundException();
    return detail;
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

    const currentStageId = await this.pipeline.findStageOf(membership.company.id, job.id, applicationId);
    if (!currentStageId) throw new NotFoundException();
    if (currentStageId === to.id) throw new ConflictException('The candidate is already in that stage.');

    const from = job.stages.find((stage) => stage.id === currentStageId);
    if (!from) throw new NotFoundException();

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
}