import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { Throttle, minutes } from '@nestjs/throttler';
import { ApplicationsService } from './applications.service.js';
import { createUploadSchema, type CreateUploadDto } from './dto/create-upload.dto.js';
import { submitApplicationSchema, type SubmitApplicationDto } from './dto/submit-application.dto.js';

@Public()
@Controller('public/:companySlug/:jobSlug')
export class PublicController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  get(@Param('companySlug') companySlug: string, @Param('jobSlug') jobSlug: string) {
    return this.applications.getPublicJob(companySlug, jobSlug);
  }

  /**
   * Starts a file upload. Called by the web app's Server Action, never by the browser. It has its own
   * limit, apart from submit's: each applicant needs only a few, and every call writes a row and signs a URL.
   */
  @Throttle({ default: { limit: 20, ttl: minutes(10) } })
  @Post('uploads')
  createUpload(
    @Param('companySlug') companySlug: string,
    @Param('jobSlug') jobSlug: string,
    @Body({ schema: createUploadSchema }) dto: CreateUploadDto,
  ) {
    return this.applications.createUpload(companySlug, jobSlug, dto);
  }

  @Throttle({ default: { limit: 5, ttl: minutes(10) } })
  @Post('applications')
  submit(
    @Param('companySlug') companySlug: string,
    @Param('jobSlug') jobSlug: string,
    @Body({ schema: submitApplicationSchema }) dto: SubmitApplicationDto,
  ) {
    return this.applications.submit(companySlug, jobSlug, dto);
  }
}