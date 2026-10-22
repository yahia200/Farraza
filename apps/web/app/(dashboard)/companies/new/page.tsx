import type { Metadata } from 'next';
import { AddCompanyWizard } from '@/components/dashboard/add-company-wizard';

export const metadata: Metadata = { title: 'Add company · Farraza' };

/**
 * /companies/new, not /dashboard/new: under /dashboard, "new" would be read as
 * a company slug, and a company named "New" really gets the slug "new".
 * Inside the (dashboard) group, so it keeps the sidebar.
 */
export default function AddCompanyPage() {
  return (
    <div className="flex flex-1 items-center justify-center pb-8">
      <AddCompanyWizard />
    </div>
  );
}
