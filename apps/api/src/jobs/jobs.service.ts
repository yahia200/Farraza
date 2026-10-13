import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { randomBytes } from 'node:crypto';
import { slugify } from '../common/slugify.js';
import type { Membership } from '../companies/company.js';
import type { User } from '../users/user.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import type { UpdateJobDto } from './dto/update-job.dto.js';
import type { Job, JobWithStages } from './job.js';
import { JobPolicy } from './job.policy.js';
import { JobsRepository } from './jobs.repository.js';
import { isUniqueViolation } from '../common/db-errors.js';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobs: JobsRepository,
    private readonly authorization: AuthorizationService,
  ) { }

  async create(user: User, membership: Membership, dto: CreateJobDto): Promise<JobWithStages> {
    await this.authorization.authorize(JobPolicy, 'create', user, membership);

    const companyId = membership.company.id;
    const slug = await this.availableSlug(companyId, dto.title);

    try {
      return await this.jobs.createWithStages({
        companyId,
        title: dto.title,
        slug,
        description: dto.description ?? null,
        createdById: user.id,
      });
    } catch (error) {
        if (isUniqueViolation(error)) {
        throw new ConflictException('A job with this address was just created. Try again.');
      }
      throw error;
    }
  }

  list(membership: Membership): Promise<Job[]> {
    return this.jobs.findAllForCompany(membership.company.id);
  }

  async get(membership: Membership, jobSlug: string): Promise<JobWithStages> {
    const job = await this.jobs.findBySlug(membership.company.id, jobSlug);
    if (!job) {
      throw new NotFoundException();
    }
    return job;
  }

  async update(
    user: User,
    membership: Membership,
    jobSlug: string,
    dto: UpdateJobDto,
  ): Promise<Job> {
    await this.authorization.authorize(JobPolicy, 'update', user, membership);

    const job = await this.get(membership, jobSlug);
    const updated = await this.jobs.update(job.id, dto);
    if (!updated) {
      throw new NotFoundException();
    }
    return updated;
  }

  private async availableSlug(companyId: string, title: string): Promise<string> {
    const base = slugify(title, 60, 'job');
    return (await this.jobs.slugExists(companyId, base))
      ? `${base}-${randomBytes(2).toString('hex')}`
      : base;
  }

  async open(user: User, membership: Membership, jobSlug: string): Promise<Job> {
    await this.authorization.authorize(JobPolicy, 'update', user, membership);

    const job = await this.get(membership, jobSlug);
    if (!(await this.jobs.hasPublishedForm(job.id))) {
      throw new ConflictException('Publish the application form before opening this job.');
    }

    const opened = await this.jobs.open(job.id, new Date());
    if (!opened) {
      throw new ConflictException('This job is already open.');
    }
    return opened;
  }

  async close(user: User, membership: Membership, jobSlug: string): Promise<Job> {
    await this.authorization.authorize(JobPolicy, 'update', user, membership);

    const job = await this.get(membership, jobSlug);
    const closed = await this.jobs.close(job.id, new Date());
    if (!closed) {
      throw new ConflictException('Only open jobs can be closed.');
    }
    return closed;
  }

}