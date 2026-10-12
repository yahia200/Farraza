import { Body, Controller, Get, Param, Patch, Post, UseGuards, HttpCode } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { Membership } from '../companies/company.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentMembership } from '../companies/current-membership.decorator.js';
import type { User } from '../users/user.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { JobsService } from './jobs.service.js';

@Controller('companies/:companySlug/jobs')
@UseGuards(CompanyMemberGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) { }

  @Post()
  create(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobs.create(user, membership, dto);
  }

  @Get()
  list(@CurrentMembership() membership: Membership) {
    return this.jobs.list(membership);
  }

  @Get(':jobSlug')
  get(@CurrentMembership() membership: Membership, @Param('jobSlug') jobSlug: string) {
    return this.jobs.get(membership, jobSlug);
  }

  @Patch(':jobSlug')
  update(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobs.update(user, membership, jobSlug, dto);
  }

  @Post(':jobSlug/open')
  @HttpCode(200)
  open(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
  ) {
    return this.jobs.open(user, membership, jobSlug);
  }

  @Post(':jobSlug/close')
  @HttpCode(200)
  close(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
  ) {
    return this.jobs.close(user, membership, jobSlug);
  }

}