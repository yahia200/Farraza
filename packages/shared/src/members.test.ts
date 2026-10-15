import { describe, expect, it } from 'vitest';
import {
  assignableRoles,
  canAddMember,
  canManageJobs,
  canMoveApplications,
  canChangeRole,
  canRemoveMember,
  compareRoles,
  type MemberRole,
} from './members.js';

const remove = (actorRole: MemberRole, targetRole: MemberRole, self = false) =>
  canRemoveMember({ actorId: 'a', actorRole, targetId: self ? 'a' : 'b', targetRole });

describe('member permissions', () => {
  it('lets you add only roles below your own', () => {
    expect(assignableRoles('owner')).toEqual(['admin', 'recruiter', 'interviewer']);
    expect(assignableRoles('admin')).toEqual(['recruiter', 'interviewer']);
    expect(assignableRoles('recruiter')).toEqual([]);
    expect(canAddMember('admin', 'admin')).toBe(false);
  });

  it('needs you to outrank both the current and the new role to change one', () => {
    expect(canChangeRole('owner', 'admin', 'recruiter')).toBe(true);
    expect(canChangeRole('admin', 'recruiter', 'interviewer')).toBe(true);
    expect(canChangeRole('admin', 'recruiter', 'admin')).toBe(false);
    expect(canChangeRole('admin', 'admin', 'recruiter')).toBe(false);
    expect(canChangeRole('recruiter', 'interviewer', 'recruiter')).toBe(false);
  });

  it('never removes an owner, but lets others leave or remove those below them', () => {
    expect(remove('owner', 'owner', true)).toBe(false);
    expect(remove('admin', 'owner')).toBe(false);
    expect(remove('recruiter', 'recruiter', true)).toBe(true);
    expect(remove('recruiter', 'interviewer')).toBe(false);
    expect(remove('admin', 'recruiter')).toBe(true);
    expect(remove('admin', 'admin')).toBe(false);
  });

  it('sorts higher roles first', () => {
    const roles: MemberRole[] = ['interviewer', 'owner', 'recruiter', 'admin'];
    expect([...roles].sort(compareRoles).slice(0, 2)).toEqual(['owner', 'admin']);
  });
});

describe('job permissions', () => {
  it('lets everyone except interviewers manage jobs', () => {
    expect(['owner', 'admin', 'recruiter', 'interviewer'].map((role) => canManageJobs(role as MemberRole))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});

describe('application permissions', () => {
  it('lets everyone except interviewers move applications', () => {
    const roles: MemberRole[] = ['owner', 'admin', 'recruiter', 'interviewer'];
    expect(roles.map((role) => canMoveApplications(role))).toEqual([true, true, true, false]);
  });
});
