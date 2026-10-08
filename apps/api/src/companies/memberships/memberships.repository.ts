import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Member, MemberRole } from '../company.js';

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async listForCompany(companyId: string): Promise<Member[]> {
    const rows = await this.prisma.db.orm.public.Membership
      .where({ companyId })
      .include('user')
      .all();

    return rows.map((row) => ({
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      role: row.role as MemberRole,
      joinedAt: row.createdAt,
    }));
  }

  /** Returns false when the user is already a member. */
  async add(companyId: string, userId: string, role: MemberRole): Promise<boolean> {
    try {
      await this.prisma.db.orm.public.Membership.create({ companyId, userId, role });
      return true;
    } catch (error) {
      if (error instanceof Error && 'sqlState' in error && error.sqlState === '23505') {
        return false;
      }
      throw error;
    }
  }

  async findMember(companyId: string, userId: string): Promise<Member | null> {
    const row = await this.prisma.db.orm.public.Membership
      .where({ companyId, userId })
      .include('user')
      .first();

    return row
      ? {
        userId: row.userId,
        name: row.user.name,
        email: row.user.email,
        role: row.role as MemberRole,
        joinedAt: row.createdAt,
      }
      : null;
  }

  /** Returns false if the member's role is no longer `currentRole`. */
  async updateRole(
    companyId: string,
    userId: string,
    currentRole: MemberRole,
    newRole: MemberRole,
  ): Promise<boolean> {
    const row = await this.prisma.db.orm.public.Membership
      .where({ companyId, userId, role: currentRole })
      .update({ role: newRole });
    return row !== null;
  }

  /** Returns false if the member's role is no longer `currentRole`. */
  async remove(companyId: string, userId: string, currentRole: MemberRole): Promise<boolean> {
    const row = await this.prisma.db.orm.public.Membership
      .where({ companyId, userId, role: currentRole })
      .delete();
    return row !== null;
  }
}