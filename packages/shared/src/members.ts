import type { AssignableRole } from './companies.js';

/**
 * Who may do what to a company's members. The API's MemberPolicy
 * (apps/api/src/companies/memberships/member.policy.ts) enforces these; the
 * web app uses the same functions to decide which actions to offer.
 */

export type MemberRole = 'owner' | 'admin' | 'recruiter' | 'interviewer';

const RANK: Record<MemberRole, number> = {
  owner: 3,
  admin: 2,
  recruiter: 1,
  interviewer: 1,
};

/** Roles that can be given out, highest first (`owner` is only set on creation). */
const ASSIGNABLE: readonly AssignableRole[] = ['admin', 'recruiter', 'interviewer'];

/** Whether `actor` ranks strictly above `other`. Recruiter and interviewer are equal. */
export function outranks(actor: MemberRole, other: MemberRole): boolean {
  return RANK[actor] > RANK[other];
}

/** For sorting: higher roles first. */
export function compareRoles(a: MemberRole, b: MemberRole): number {
  return RANK[b] - RANK[a];
}

/** Adding someone: only to a role below your own. */
export function canAddMember(actor: MemberRole, role: MemberRole): boolean {
  return outranks(actor, role);
}

/** The roles `actor` may add people as, or change people to. */
export function assignableRoles(actor: MemberRole): AssignableRole[] {
  return ASSIGNABLE.filter((role) => outranks(actor, role));
}

/** Changing a role: you must outrank both the current and the new role. */
export function canChangeRole(actor: MemberRole, current: MemberRole, next: MemberRole): boolean {
  return outranks(actor, current) && outranks(actor, next);
}

/** Removing: never an owner; otherwise yourself (leaving) or someone you outrank. */
export function canRemoveMember(input: {
  actorId: string;
  actorRole: MemberRole;
  targetId: string;
  targetRole: MemberRole;
}): boolean {
  if (input.targetRole === 'owner') {
    return false;
  }
  return input.actorId === input.targetId || outranks(input.actorRole, input.targetRole);
}

/**
 * Moving an application between stages: everyone except interviewers. Mirrors
 * ApplicationPolicy.move (apps/api/src/pipeline/application.policy.ts). Adding
 * a note needs no check here: every member may (ApplicationPolicy.addNote).
 */
export function canMoveApplications(role: MemberRole): boolean {
  return role !== 'interviewer';
}

/** Creating, editing, opening and closing jobs: everyone except interviewers. */
export function canManageJobs(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'recruiter';
}
