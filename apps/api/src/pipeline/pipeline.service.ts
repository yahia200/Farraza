import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import type { Membership } from '../companies/company.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { User } from '../users/user.js';
import { ApplicationPolicy } from './application.policy.js';
import type { CreateNoteDto } from './dto/create-note.dto.js';
import type { MoveApplicationDto } from './dto/move-application.dto.js';
import type { BoardColumn } from './pipeline.js';
import { PipelineRepository } from './pipeline.repository.js';

@Injectable()
export class PipelineService {
  constructor(
    private readonly pipeline: PipelineRepository,
    private readonly jobs: JobsService,
    private readonly authorization: AuthorizationService,
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