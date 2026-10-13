import { Policy } from '@nestjs/authorization';
import { canManageJobs } from '@repo/shared';
import type { Membership } from '../companies/company.js';
import type { User } from '../users/user.js';

/** The rule lives in @repo/shared (packages/shared/src/members.ts), shared with the web app. */
@Policy()
export class JobPolicy {
  create(_user: User, membership: Membership) {
    return canManageJobs(membership.role);
  }

  update(_user: User, membership: Membership) {
    return canManageJobs(membership.role);
  }
}
