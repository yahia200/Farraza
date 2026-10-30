'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import type { CurrentUser } from '@/lib/dal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { UserAvatar } from './user-avatar';

/** Adapted from shadcn block sidebar-07 (nav-user): just the account and sign out for now. */
export function NavUser({ user }: { user: CurrentUser }) {
  const { isMobile } = useSidebar();
  const [signingOut, startSignOut] = useTransition();

  const identity = (
    <>
      <UserAvatar seed={user.id} />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs">{user.email}</span>
      </div>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
            {identity}
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">{identity}</div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLinkItem render={<Link href="/dashboard/settings" />}>
                <SettingsIcon />
                Settings
              </DropdownMenuLinkItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Server Action from an event handler: 01-getting-started/07-mutating-data.md (Event Handlers). */}
            <DropdownMenuItem
              variant="destructive"
              disabled={signingOut}
              onClick={() => startSignOut(() => signOut())}
            >
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
