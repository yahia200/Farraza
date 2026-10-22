import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { ApplicationsService } from './applications.service.js';

/**
 * The applicant-facing listing of a company's open jobs:
 * GET /api/public/:companySlug, mirroring the web page at /{companySlug}.
 *
 * It sits one segment shallower than the apply controller
 * (public/:companySlug/:jobSlug), so the two routes never overlap — a
 * single-segment /public/acme can't be mistaken for a job slug. Like the apply
 * endpoints it is @Public() (no session) and leans on the global ThrottlerGuard
 * (100/min); the web app serves it from its shared cache, so the API sees few
 * hits. Only `open` jobs are returned, with a safe public projection.
 */
@Public()
@Controller('public/:companySlug')
export class PublicCompanyController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@Param('companySlug') companySlug: string) {
    return this.applications.listCompanyJobs(companySlug);
  }

  /**
   * Just the company's branding, for the public layout to theme every page
   * under /{companySlug} with one cheap call (no jobs, no form).
   *
   * The static `branding` segment collides in shape with the apply route
   * (public/:companySlug/:jobSlug). It wins because this controller is listed
   * before PublicController in ApplicationsModule, so Nest registers
   * `public/:companySlug/branding` ahead of `public/:companySlug/:jobSlug`.
   * The only cost: a job slugged exactly `branding` is unreachable on its
   * public apply URL — acceptable, and slugs auto-suffix on collision anyway.
   */
  @Get('branding')
  branding(@Param('companySlug') companySlug: string) {
    return this.applications.getCompanyBranding(companySlug);
  }
}
