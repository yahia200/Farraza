import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import type { User } from '../../users/user.js';
import { UsersRepository } from '../../users/users.repository.js';
import type { Member, Membership } from '../company.js';
import type { AddMemberDto } from '../dto/add-member.dto.js';
import { MemberPolicy } from './member.policy.js';
import { MembershipsRepository } from './memberships.repository.js';
import type { UpdateMemberDto } from './dto/update-member.dto.js';

@Injectable()
export class MembersService {
  constructor(
    private readonly memberships: MembershipsRepository,
    private readonly users: UsersRepository,
    private readonly authorization: AuthorizationService,
  ) { }

  list(membership: Membership): Promise<Member[]> {
    return this.memberships.listForCompany(membership.company.id);
  }

  async add(user: User, membership: Membership, dto: AddMemberDto): Promise<Member> {
    await this.authorization.authorize(MemberPolicy, 'add', user, membership, dto.role);

    const target = await this.users.findByEmail(dto.email);
    if (!target) {
      throw new NotFoundException('No account uses that email. Ask them to sign up first.');
    }

    const added = await this.memberships.add(membership.company.id, target.id, dto.role);
    if (!added) {
      throw new ConflictException('That person is already a member.');
    }

    return {
      userId: target.id,
      name: target.name,
      email: target.email,
      role: dto.role,
      joinedAt: new Date(),
    };
  }

  async changeRole(
    user: User,
    membership: Membership,
    targetUserId: string,
    dto: UpdateMemberDto,
  ): Promise<Member> {
    const target = await this.requireMember(membership, targetUserId);
    await this.authorization.authorize(MemberPolicy, 'changeRole', user, membership, target, dto.role);

    const updated = await this.memberships.updateRole(
      membership.company.id,
      target.userId,
      target.role,
      dto.role,
    );
    if (!updated) {
      throw new ConflictException('This member was changed by someone else. Reload and try again.');
    }
    return { ...target, role: dto.role };
  }

  async remove(user: User, membership: Membership, targetUserId: string): Promise<void> {
    const target = await this.requireMember(membership, targetUserId);
    await this.authorization.authorize(MemberPolicy, 'remove', user, membership, target);

    const removed = await this.memberships.remove(membership.company.id, target.userId, target.role);
    if (!removed) {
      throw new ConflictException('This member was changed by someone else. Reload and try again.');
    }
  }

  private async requireMember(membership: Membership, userId: string): Promise<Member> {
    const target = await this.memberships.findMember(membership.company.id, userId);
    if (!target) {
      throw new NotFoundException();
    }
    return target;
  }

}