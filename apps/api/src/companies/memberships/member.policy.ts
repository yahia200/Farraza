import { Policy } from '@nestjs/authorization';
import type { User } from '../../users/user.js';
import type { Member, MemberRole, Membership } from '../company.js';

const RANK: Record<MemberRole, number> = {
  owner: 3,
  admin: 2,
  recruiter: 1,
  interviewer: 1,
};

const isAbove = (actor: MemberRole, other: MemberRole) => RANK[actor] > RANK[other];

@Policy()
export class MemberPolicy {
  add(_user: User, membership: Membership, role: MemberRole) {
    return isAbove(membership.role, role);
  }

  changeRole(_user: User, membership: Membership, target: Member, newRole: MemberRole) {
    return isAbove(membership.role, target.role) && isAbove(membership.role, newRole);
  }

  remove(user: User, membership: Membership, target: Member) {
    if (target.role === 'owner') return false;
    return user.id === target.userId || isAbove(membership.role, target.role);
  }
}