import { Policy } from '@nestjs/authorization';
import { canAddMember, canChangeRole, canRemoveMember } from '@repo/shared';
import type { User } from '../../users/user.js';
import type { Member, MemberRole, Membership } from '../company.js';

/**
 * The rules live in @repo/shared (packages/shared/src/members.ts), so the web
 * app can offer exactly the actions this policy allows.
 */
@Policy()
export class MemberPolicy {
  add(_user: User, membership: Membership, role: MemberRole) {
    return canAddMember(membership.role, role);
  }

  changeRole(_user: User, membership: Membership, target: Member, newRole: MemberRole) {
    return canChangeRole(membership.role, target.role, newRole);
  }

  remove(user: User, membership: Membership, target: Member) {
    return canRemoveMember({
      actorId: user.id,
      actorRole: membership.role,
      targetId: target.userId,
      targetRole: target.role,
    });
  }
}
