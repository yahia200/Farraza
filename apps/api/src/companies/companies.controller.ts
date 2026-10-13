import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { createCompanySchema, type CreateCompanyDto } from './dto/create-company.dto.js';
import { CurrentUser, Public } from '@nestjs/authentication';
import { updateCompanySchema, type UpdateCompanyDto } from './dto/update-company.dto.js';
import type { Membership } from './company.js';
import type { User } from '../users/user.js';
import { CompanyMemberGuard } from './company-member.guard.js';
import { CurrentMembership } from './current-membership.decorator.js';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) { }

  @Post()
  create(@CurrentUser('id') userId: string, @Body({ schema: createCompanySchema }) createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(userId, createCompanyDto);
  }

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.companiesService.listForUser(userId);
  }

  @Patch()
  update(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Body({ schema: updateCompanySchema }) updateCompanyDto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(user, membership, updateCompanyDto);
  }

}
