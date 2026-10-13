import type { MemberRole } from '@repo/shared';

/** How roles are shown in the UI. */
export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  recruiter: 'Recruiter',
  interviewer: 'Interviewer',
};
