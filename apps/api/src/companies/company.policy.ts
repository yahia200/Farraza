import { Policy } from '@nestjs/authorization';
import type { User } from '../users/user.js';
import type { Membership } from './company.js';

@Policy()
export class CompanyPolicy {
  update(_user: User, membership: Membership) {
    return membership.role === 'owner' || membership.role === 'admin';
  }

  delete(_user: User, membership: Membership) {
    return membership.role === 'owner';
  }
}