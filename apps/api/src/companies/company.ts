export type MemberRole = 'owner' | 'admin' | 'recruiter' | 'interviewer';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
}

export interface CompanyWithRole extends Company {
  role: MemberRole;
}

export interface Membership {
  userId: string;
  role: MemberRole;
  company: Company;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: Date;
}