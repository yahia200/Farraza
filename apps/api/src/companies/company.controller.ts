import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { CompaniesService } from './companies.service.js';
import type { Membership } from './company.js';
import { CompanyMemberGuard } from './company-member.guard.js';
import { CurrentMembership } from './current-membership.decorator.js';
import { updateCompanySchema, type UpdateCompanyDto } from './dto/update-company.dto.js';

@Controller('companies/:companySlug')
@UseGuards(CompanyMemberGuard)
export class CompanyController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  get(@CurrentMembership() membership: Membership) {
    return { ...membership.company, role: membership.role };
  }

  @Patch()
  update(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Body({ schema: updateCompanySchema }) changes: UpdateCompanyDto,
  ) {
    return this.companiesService.update(user, membership, changes);
  }
}