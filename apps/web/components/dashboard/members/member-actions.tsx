'use client';

import { useState, useTransition } from 'react';
import { LogOutIcon, MoreHorizontalIcon, UserMinusIcon, UserCogIcon } from 'lucide-react';
import { assignableRoles, canChangeRole, canRemoveMember, type AssignableRole } from '@repo/shared';
import { changeMemberRole, removeMember } from '@/app/actions/members';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import type { MemberRow, MembersTableMeta } from './data-table-features';
import { ROLE_LABELS } from './role-labels';

/**
 * The ⋯ menu on a member's row (row actions, from shadcn's data-table guide).
 * Offers only what the shared rules in @repo/shared allow; the API checks the
 * same rules again, so hiding is about clarity, not security.
 */
export function MemberActions({ member, meta }: { member: MemberRow; meta: MembersTableMeta }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changing, startChanging] = useTransition();
  const [removing, startRemoving] = useTransition();

  const isYou = member.userId === meta.currentUserId;
  const roleChoices = assignableRoles(meta.currentRole).filter((role) =>
    canChangeRole(meta.currentRole, member.role, role),
  );
  const canRemove = canRemoveMember({
    actorId: meta.currentUserId,
    actorRole: meta.currentRole,
    targetId: member.userId,
    targetRole: member.role,
  });
  if (roleChoices.length === 0 && !canRemove) {
    return null;
  }

  function onRoleChange(role: AssignableRole) {
    if (role === member.role) return;
    // Server Action from an event handler, inside a transition for the pending state:
    // node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
    startChanging(async () => {
      const result = await changeMemberRole(meta.companySlug, member.userId, role);
      if (result.ok) {
        toast.add({ type: 'success', title: 'Role changed', description: `${member.name} is now ${ROLE_LABELS[role].toLowerCase()}.` });
      } else {
        toast.add({ type: 'error', title: "Couldn't change the role", description: result.formError });
      }
    });
  }

  function onRemove() {
    startRemoving(async () => {
      // Leaving redirects to /dashboard from the action, so only removals return here.
      const result = await removeMember(meta.companySlug, member.userId, { leaving: isYou });
      setConfirmOpen(false);
      if (result.ok) {
        toast.add({ type: 'success', title: 'Member removed', description: `${member.name} no longer has access.` });
      } else {
        toast.add({ type: 'error', title: "Couldn't remove the member", description: result.formError });
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`} />}
          disabled={changing}
        >
          {changing ? <Spinner /> : <MoreHorizontalIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {/* DropdownMenuLabel is Base UI's Menu.GroupLabel: it must sit inside a group. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{member.name}</DropdownMenuLabel>
            {roleChoices.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserCogIcon />
                Change role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={member.role}
                  onValueChange={(value) => onRoleChange(value as AssignableRole)}
                >
                  {roleChoices.map((role) => (
                    // closeOnClick: Base UI keeps radio menus open by default; here choosing is the action.
                    <DropdownMenuRadioItem key={role} value={role} closeOnClick>
                      {ROLE_LABELS[role]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            )}
          </DropdownMenuGroup>
          {canRemove && (
            <>
              <DropdownMenuSeparator />
              {/* Opens the confirmation by controlling its state (Base UI menu docs, "Open a dialog"). */}
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                {isYou ? <LogOutIcon /> : <UserMinusIcon />}
                {isYou ? 'Leave' : 'Remove'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !removing && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isYou ? 'Leave this company?' : `Remove ${member.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {isYou
                ? "You'll lose access to its jobs and candidates. An admin can add you again later."
                : `${member.name} will lose access to this company. You can add them again later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            {/* AlertDialogAction is a plain Button: the dialog stays open while removing. */}
            <AlertDialogAction variant="destructive" onClick={onRemove} disabled={removing}>
              {removing && <Spinner data-icon="inline-start" />}
              {isYou ? 'Leave' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
