import { Policy } from '@nestjs/authorization';
import type { MemberRole, Membership } from '../companies/company.js';
import type { User } from '../users/user.js';

const MOVERS: ReadonlySet<MemberRole> = new Set(['owner', 'admin', 'recruiter']);

@Policy()
export class ApplicationPolicy {
  move(_user: User, membership: Membership) {
    return MOVERS.has(membership.role);
  }

  /** Any member may comment; the membership guard has already checked they're a member. */
  addNote(_user: User, _membership: Membership) {
    return true;
  }

  /** Any member may rate, interviewers included: a Rating is always the caller's own. */
  rate(_user: User, _membership: Membership) {
    return true;
  }
}