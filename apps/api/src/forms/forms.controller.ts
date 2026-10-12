import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { Membership } from '../companies/company.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentMembership } from '../companies/current-membership.decorator.js';
import type { User } from '../users/user.js';
import { SaveFormDto } from './dto/save-form.dto.js';
import { FormsService } from './forms.service.js';

@Controller('companies/:companySlug/jobs/:jobSlug/form')
@UseGuards(CompanyMemberGuard)
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get()
  get(@CurrentMembership() membership: Membership, @Param('jobSlug') jobSlug: string) {
    return this.forms.get(membership, jobSlug);
  }

  @Put()
  save(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
    @Body() dto: SaveFormDto,
  ) {
    return this.forms.saveDraft(user, membership, jobSlug, dto.fields);
  }

  @Post('publish')
  @HttpCode(200)
  publish(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('jobSlug') jobSlug: string,
  ) {
    return this.forms.publish(user, membership, jobSlug);
  }
}