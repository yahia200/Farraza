import { Body, Controller, Get, Patch, Post, Delete, ParseUUIDPipe, UseGuards, HttpCode, Param } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { User } from '../../users/user.js';
import type { Membership } from '../company.js';
import { CompanyMemberGuard } from '../company-member.guard.js';
import { CurrentMembership } from '../current-membership.decorator.js';
import { addMemberSchema, type AddMemberDto } from '../dto/add-member.dto.js';
import { MembersService } from './members.service.js';
import { updateMemberSchema, type UpdateMemberDto } from './dto/update-member.dto.js';

@Controller('companies/:companySlug/members')
@UseGuards(CompanyMemberGuard)
export class MembersController {
  constructor(private readonly members: MembersService) { }

  @Get()
  list(@CurrentMembership() membership: Membership) {
    return this.members.list(membership);
  }

  @Post()
  add(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Body({ schema: addMemberSchema }) dto: AddMemberDto,
  ) {
    return this.members.add(user, membership, dto);
  }

  @Patch(':userId')
  changeRole(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body({ schema: updateMemberSchema }) dto: UpdateMemberDto,
  ) {
    return this.members.changeRole(user, membership, userId, dto);
  }

  @Delete(':userId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @CurrentMembership() membership: Membership,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.members.remove(user, membership, userId);
  }
}