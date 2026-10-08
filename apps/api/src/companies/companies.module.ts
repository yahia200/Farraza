import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { CompaniesController } from './companies.controller.js';
import { CompaniesRepository } from './companies.repository.js';
import { CompanyController } from './company.controller.js';
import { CompanyPolicy } from './company.policy.js';
import { CompanyMemberGuard } from './company-member.guard.js';
import { MembersController } from './memberships/members.controller.js';
import { MembersService } from './memberships/members.service.js';
import { MembershipsRepository } from './memberships/memberships.repository.js';
import { MemberPolicy } from './memberships/member.policy.js';

import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [CompaniesController, CompanyController, MembersController],
  providers: [CompaniesService, CompaniesRepository, CompanyPolicy, CompanyMemberGuard, MembersService, MembershipsRepository, MemberPolicy],
})
export class CompaniesModule {}
