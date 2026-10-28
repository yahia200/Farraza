import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards, HttpCode } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { Membership } from '../companies/company.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentMembership } from '../companies/current-membership.decorator.js';
import type { User } from '../users/user.js';
import { createJobSchema, type CreateJobDto } from './dto/create-job.dto.js';
import {
  saveHighlightedQuestionsSchema,
  type SaveHighlightedQuestionsDto,
} from './dto/save-highlighted-questions.dto.js';
import {
  saveRatingCriteriaSchema,
  type SaveRatingCriteriaDto,
} from './dto/save-rating-criteria.dto.js';
import { updateJobSchema, type UpdateJobDto } from './dto/update-job.dto.js';
import { JobsService } from './jobs.service.js';

@Controller('companies/:companySlug/jobs')
@UseGuards(CompanyMemberGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) { }

  @Post()
  create(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Body({ schema: createJobSchema }) dto: CreateJobDto,
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
    @Body({ schema: updateJobSchema }) dto: UpdateJobDto,
  ) {
    return this.jobs.update(user, membership, jobSlug, dto);
  }

  @Put(':jobSlug/highlighted-questions')
  saveHighlightedQuestions(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Body({ schema: saveHighlightedQuestionsSchema }) dto: SaveHighlightedQuestionsDto,
  ) {
    return this.jobs.saveHighlightedQuestions(user, membership, jobSlug, dto);
  }

  @Put(':jobSlug/rating-criteria')
  saveRatingCriteria(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Body({ schema: saveRatingCriteriaSchema }) dto: SaveRatingCriteriaDto,
  ) {
    return this.jobs.saveRatingCriteria(user, membership, jobSlug, dto);
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