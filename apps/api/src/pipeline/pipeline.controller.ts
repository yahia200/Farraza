import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { Membership } from '../companies/company.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentMembership } from '../companies/current-membership.decorator.js';
import type { User } from '../users/user.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { MoveApplicationDto } from './dto/move-application.dto.js';
import { PipelineService } from './pipeline.service.js';

@Controller('companies/:companySlug/jobs/:jobSlug/applications')
@UseGuards(CompanyMemberGuard)
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get()
  board(@CurrentMembership() membership: Membership, @Param('jobSlug') jobSlug: string) {
    return this.pipeline.board(membership, jobSlug);
  }

  @Get(':applicationId')
  detail(
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.pipeline.detail(membership, jobSlug, applicationId);
  }

  @Post(':applicationId/move')
  @HttpCode(200)
  move(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: MoveApplicationDto,
  ) {
    return this.pipeline.move(user, membership, jobSlug, applicationId, dto);
  }

  @Post(':applicationId/notes')
  addNote(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.pipeline.addNote(user, membership, jobSlug, applicationId, dto);
  }
}