import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Company, CompanyWithRole, MemberRole, Membership } from './company.js';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) { }

  async slugExists(slug: string): Promise<boolean> {
    const row = await this.prisma.db.orm.public.Company.where({ slug }).first();
    return row !== null;
  }

  async findBySlug(slug: string): Promise<Company | null> {
    const row = await this.prisma.db.orm.public.Company.where({ slug }).first();
    return row ? toCompany(row) : null;
  }

  async createWithOwner(input: { name: string; slug: string; ownerId: string }): Promise<Company> {
    return this.prisma.db.transaction(async (tx) => {
      const row = await tx.orm.public.Company.create({
        name: input.name,
        slug: input.slug,
      });
      await tx.orm.public.Membership.create({
        userId: input.ownerId,
        companyId: row.id,
        role: 'owner',
      });
      return toCompany(row);
    });
  }

  async findAllForUser(userId: string): Promise<CompanyWithRole[]> {
    const rows = await this.prisma.db.orm.public.Membership
      .where({ userId })
      .include('company')
      .all();

    return rows.map((row) => ({
      ...toCompany(row.company),
      role: row.role,
    }));
  }

  async findMembership(userId: string, companySlug: string): Promise<Membership | null> {
    const company = await this.prisma.db.orm.public.Company.where({ slug: companySlug }).first();
    if (!company) return null;

    const row = await this.prisma.db.orm.public.Membership
      .where({ userId, companyId: company.id })
      .first();

    return row ? { userId, role: row.role as MemberRole, company: toCompany(company) } : null;
  }

  async update(id: string, UpdateCompanyDto: { name?: string; brandColor?: string }): Promise<Company | null> {
    const row = await this.prisma.db.orm.public.Company.where({ id }).update(UpdateCompanyDto);
    return row ? toCompany(row) : null;
  }

  async addMember(companyId: string, userId: string, role: MemberRole): Promise<boolean> {
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


}



function toCompany(row: {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
}): Company {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    brandColor: row.brandColor,
  };
}