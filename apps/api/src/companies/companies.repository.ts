import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Company, CompanyWithRole, MemberRole, Membership } from './company.js';
import { isUniqueViolation } from '../common/db-errors.js';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) { }

  private get companies() {
    return this.prisma.db.orm.public.Company;
  }
  private get memberships() {
    return this.prisma.db.orm.public.Membership;
  }

  async slugExists(slug: string): Promise<boolean> {
    const row = await this.companies.where({ slug }).first();
    return row !== null;
  }

  async findBySlug(slug: string): Promise<Company | null> {
    const row = await this.companies.where({ slug }).first();
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
    const rows = await this.memberships
      .where({ userId })
      .include('company')
      .all();

    return rows.map((row) => ({
      ...toCompany(row.company),
      role: row.role,
    }));
  }

  async findMembership(userId: string, companySlug: string): Promise<Membership | null> {
    const company = await this.companies.where({ slug: companySlug }).first();
    if (!company) return null;

    const row = await this.memberships
      .where({ userId, companyId: company.id })
      .first();

    return row ? { userId, role: row.role as MemberRole, company: toCompany(company) } : null;
  }

  /** Keys left out stay as they are; `null` clears the logo or brand color. */
  async update(
    id: string,
    UpdateCompanyDto: { name?: string; logoUrl?: string | null; brandColor?: string | null },
  ): Promise<Company | null> {
    const row = await this.companies.where({ id }).update(UpdateCompanyDto);
    return row ? toCompany(row) : null;
  }

  async addMember(companyId: string, userId: string, role: MemberRole): Promise<boolean> {
    try {
      await this.memberships.create({ companyId, userId, role });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
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