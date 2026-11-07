import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { Membership } from '../companies/company.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentMembership } from '../companies/current-membership.decorator.js';
import type { User } from '../users/user.js';
import { RecheckService } from './recheck.service.js';

@Controller('companies/:companySlug/jobs/:jobSlug/recheck')
@UseGuards(CompanyMemberGuard)
export class RecheckController {
  constructor(private readonly recheck: RecheckService) {}

  /** `{ count }`: the Applications a Re-check would touch now. */
  @Get()
  count(@CurrentMembership() membership: Membership, @Param('jobSlug') jobSlug: string) {
    return this.recheck.count(membership, jobSlug);
  }

  /** Queues a Re-check (a no-op while one runs) and answers the status, 202. */
  @Post()
  @HttpCode(202)
  start(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
  ) {
    return this.recheck.start(user, membership, jobSlug);
  }

  /** `{ state: 'running', processed, total }` or `{ state: 'idle', lastRun }`. */
  @Get('status')
  status(@CurrentMembership() membership: Membership, @Param('jobSlug') jobSlug: string) {
    return this.recheck.status(membership, jobSlug);
  }
}
