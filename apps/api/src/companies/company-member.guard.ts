import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../users/user.js';
import { CompaniesRepository } from './companies.repository.js';

@Injectable()
export class CompanyMemberGuard implements CanActivate {
  constructor(private readonly companies: CompaniesRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as User | undefined;
    const slug = request.params.companySlug as string | undefined;

    const membership = user && slug ? await this.companies.findMembership(user.id, slug) : null;
    if (!membership) {
      throw new NotFoundException();
    }

    request.membership = membership;
    return true;
  }
}