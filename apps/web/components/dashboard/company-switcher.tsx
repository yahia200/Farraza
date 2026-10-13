'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
import type { MyCompany } from '@/lib/dal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { initials } from './initials';

/** Adapted from shadcn block sidebar-07 (team-switcher): switches between your companies. */
export function CompanySwitcher({ companies }: { companies: MyCompany[] }) {
  const { companySlug } = useParams<{ companySlug?: string }>();
  const { isMobile } = useSidebar();

  const active = companies.find((company) => company.slug === companySlug) ?? companies[0];
  if (!active) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <CompanyLogo company={active} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{active.name}</span>
              <span className="truncate text-xs capitalize">{active.role}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit min-w-56"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Companies</DropdownMenuLabel>
              {companies.map((company) => (
                <DropdownMenuLinkItem
                  key={company.id}
                  render={<Link href={`/dashboard/${company.slug}`} />}
                  className="gap-2 p-2"
                >
                  <CompanyLogo company={company} className="size-6" />
                  {company.name}
                </DropdownMenuLinkItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* As in sidebar-07's "Add team". */}
            <DropdownMenuLinkItem render={<Link href="/companies/new" />} className="gap-2 p-2 text-muted-foreground">
                <PlusIcon className="size-4" />
              <span className="font-medium">Add company</span>
            </DropdownMenuLinkItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function CompanyLogo({ company, className }: { company: MyCompany; className?: string }) {
  return (
    <Avatar className={className}>
      {company.logoUrl && <AvatarImage src={company.logoUrl} alt="" />}
      <AvatarFallback
        className="rounded-[inherit] bg-sidebar-primary text-xs text-sidebar-primary-foreground"
        style={company.brandColor ? { backgroundColor: company.brandColor, color: 'white' } : undefined}
      >
        {initials(company.name)}
      </AvatarFallback>
    </Avatar>
  );
}
