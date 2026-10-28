import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { Membership } from '../companies/company.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentMembership } from '../companies/current-membership.decorator.js';
import type { User } from '../users/user.js';
import { createNoteSchema, type CreateNoteDto } from './dto/create-note.dto.js';
import { moveApplicationSchema, type MoveApplicationDto } from './dto/move-application.dto.js';
import { saveRatingSchema, type SaveRatingDto } from './dto/save-rating.dto.js';
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

  @Get(':applicationId/files')
  files(
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.pipeline.listFiles(membership, jobSlug, applicationId);
  }

  /** A fresh link every call (never cached): `{ url, expiresInSeconds }`. */
  @Get(':applicationId/files/:fileId/download')
  downloadFile(
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.pipeline.downloadLink(membership, jobSlug, applicationId, fileId);
  }

  /** Like `download`, but an inline link for the candidate sheet's viewer; 400 for types it doesn't render. */
  @Get(':applicationId/files/:fileId/view')
  viewFile(
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.pipeline.viewLink(membership, jobSlug, applicationId, fileId);
  }

  @Post(':applicationId/move')
  @HttpCode(200)
  move(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body({ schema: moveApplicationSchema }) dto: MoveApplicationDto,
  ) {
    return this.pipeline.move(user, membership, jobSlug, applicationId, dto);
  }

  @Post(':applicationId/notes')
  addNote(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body({ schema: createNoteSchema }) dto: CreateNoteDto,
  ) {
    return this.pipeline.addNote(user, membership, jobSlug, applicationId, dto);
  }

  /** Gives or replaces the caller's own Rating; the Member comes from the session, never the body. */
  @Put(':applicationId/rating')
  rate(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body({ schema: saveRatingSchema }) dto: SaveRatingDto,
  ) {
    return this.pipeline.rate(user, membership, jobSlug, applicationId, dto);
  }
}