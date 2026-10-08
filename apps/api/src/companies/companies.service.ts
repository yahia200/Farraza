import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CompaniesRepository } from './companies.repository.js';
import type { CompanyWithRole, Company } from './company.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { AuthorizationService } from '@nestjs/authorization';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import type { User } from '../users/user.js';
import { CompanyPolicy } from './company.policy.js';
import type { Membership } from './company.js';

@Injectable()
export class CompaniesService {
  constructor(private readonly companies: CompaniesRepository, private readonly authorization: AuthorizationService) { }

  async create(userId: string, CreateCompanyDto: CreateCompanyDto): Promise<CompanyWithRole> {
    const slug = await this.availableSlug(CreateCompanyDto.name);
    const company = await this.companies.createWithOwner({ name: CreateCompanyDto.name, slug, ownerId: userId });
    return { ...company, role: 'owner' };
  }

  listForUser(userId: string): Promise<CompanyWithRole[]> {
    return this.companies.findAllForUser(userId);
  }

  async findBySlug(slug: string): Promise<Company | null> {
    const company = await this.companies.findBySlug(slug);
    if (!company) {
      return null;
    }
    return company;
  }

  async update(user: User, membership: Membership, changes: UpdateCompanyDto): Promise<Company | null> {
    await this.authorization.authorize(CompanyPolicy, 'update', user, membership);
    return this.companies.update(membership.company.id, changes);
  }

  private async availableSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'company';

    return (await this.companies.slugExists(base))
      ? `${base}-${randomBytes(2).toString('hex')}`
      : base;
  }
}