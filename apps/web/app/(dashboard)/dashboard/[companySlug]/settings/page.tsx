import type { Metadata } from 'next';
import { CompanyPage, PageTitle } from '@/components/dashboard/company-page';
import { FormSkeleton, PageTitleSkeleton, SkeletonGroup } from '@/components/dashboard/skeletons';
import { CompanySettingsForm } from '@/components/dashboard/company-settings-form';

export const metadata: Metadata = { title: 'Settings · Farraza' };

export default function SettingsPage({ params }: PageProps<'/dashboard/[companySlug]/settings'>) {
  return (
    <CompanyPage
      params={params}
      fallback={
        <SkeletonGroup label="Loading settings" className="flex flex-col gap-6">
          <PageTitleSkeleton />
          <FormSkeleton fields={3} />
        </SkeletonGroup>
      }
    >
      {(company) => (
        <>
          <PageTitle title="Settings" description="How your company appears to candidates." />
          {/* key: a fresh form (and default values) when switching companies. */}
          <CompanySettingsForm key={company.id} company={company} />
        </>
      )}
    </CompanyPage>
  );
}
