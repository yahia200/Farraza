import type { Metadata } from 'next';
import Link from 'next/link';
import { CompanyPage, PageTitle } from '@/components/dashboard/company-page';
import { NAV_ITEMS } from '@/components/dashboard/nav-items';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Overview · Farraza' };

const DESCRIPTIONS: Record<string, string> = {
  Jobs: 'Create jobs, build their application forms and publish them.',
  Members: 'See who is on your team and what they can do.',
  Settings: "Your company's name, logo and brand color.",
};

export default function OverviewPage({ params }: PageProps<'/dashboard/[companySlug]'>) {
  return (
    <CompanyPage params={params}>
      {(company) => (
        <>
          <PageTitle title={company.name} description={`You're signed in as ${company.role}.`} />
          <div className="grid gap-4 md:grid-cols-3">
            {NAV_ITEMS.filter((item) => item.path).map((item) => (
              <Link key={item.title} href={`/dashboard/${company.slug}${item.path}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      {item.title}
                    </CardTitle>
                    <CardDescription>{DESCRIPTIONS[item.title]}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </CompanyPage>
  );
}
