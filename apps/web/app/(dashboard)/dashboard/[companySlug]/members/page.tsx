import type { Metadata } from 'next';
import { assignableRoles } from '@repo/shared';
import { CompanyPage, PageTitle } from '@/components/dashboard/company-page';
import { AddMemberDialog } from '@/components/dashboard/members/add-member-dialog';
import type { MemberRow } from '@/components/dashboard/members/data-table-features';
import { MembersTable } from '@/components/dashboard/members/members-table';
import { getCurrentUser, getMembers, type MyCompany } from '@/lib/dal';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Members · Khatwateen' };

export default function MembersPage({ params }: PageProps<'/dashboard/[companySlug]/members'>) {
  return <CompanyPage params={params}>{(company) => <Members company={company} />}</CompanyPage>;
}

async function Members({ company }: { company: MyCompany }) {
  const [members, user] = await Promise.all([getMembers(company.slug), getCurrentUser()]);
  const rows: MemberRow[] = members.map((member) => ({
    ...member,
    // Formatted on the server (lib/format.ts) so it can't differ from the browser's.
    joinedLabel: formatDate(member.joinedAt),
  }));
  const roles = assignableRoles(company.role);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Members" description="Who can work on this company's hiring." />
        {roles.length > 0 && <AddMemberDialog companySlug={company.slug} roles={roles} />}
      </div>
      <MembersTable
        data={rows}
        meta={{ companySlug: company.slug, currentUserId: user.id, currentRole: company.role }}
      />
    </>
  );
}
