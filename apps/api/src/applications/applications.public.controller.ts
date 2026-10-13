import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { Throttle, minutes } from '@nestjs/throttler';
import { ApplicationsService } from './applications.service.js';
import { submitApplicationSchema, type SubmitApplicationDto } from './dto/submit-application.dto.js';

@Public()
@Controller('public/:companySlug/:jobSlug')
export class PublicController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  get(@Param('companySlug') companySlug: string, @Param('jobSlug') jobSlug: string) {
    return this.applications.getPublicJob(companySlug, jobSlug);
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