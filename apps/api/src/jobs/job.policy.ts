import { Policy } from '@nestjs/authorization';
import type { MemberRole, Membership } from '../companies/company.js';
import type { User } from '../users/user.js';

const JOB_EDITORS: ReadonlySet<MemberRole> = new Set(['owner', 'admin', 'recruiter']);

@Policy()
export class JobPolicy {
  create(_user: User, membership: Membership) {
    return JOB_EDITORS.has(membership.role);
  }

  update(_user: User, membership: Membership) {
    return JOB_EDITORS.has(membership.role);
  }
}