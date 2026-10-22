'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlusIcon } from 'lucide-react';
import { addMemberSchema, type AddMemberInput, type AssignableRole } from '@repo/shared';
import { addMember } from '@/app/actions/members';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ROLE_LABELS } from './role-labels';

/**
 * "Add member": a Dialog with the usual form pattern
 * (https://ui.shadcn.com/docs/forms/react-hook-form). `roles` is what the
 * current user may assign (assignableRoles in @repo/shared).
 */
export function AddMemberDialog({ companySlug, roles }: { companySlug: string; roles: AssignableRole[] }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const defaultRole = roles.includes('recruiter') ? 'recruiter' : roles[0]!;
  const form = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: '', role: defaultRole },
  });
  // Select.Root `items` makes <SelectValue> show the label, not the raw value
  // (@base-ui/react docs/react/components/select.md, "Formatting the value").
  const roleItems = roles.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setFormError(undefined);
    }
  }

  async function onSubmit(values: AddMemberInput) {
    setFormError(undefined);
    const result = await addMember(companySlug, values);
    if (result.added) {
      onOpenChange(false);
      toast.add({ type: 'success', title: 'Member added', description: `${result.added.name} can now access this company.` });
      return;
    }
    setFormError(applyActionFailure(form, result));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon data-icon="inline-start" />
        Add member
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Add a member</DialogTitle>
            <DialogDescription>They need a Farraza account. Ask them to sign up first if they don&apos;t have one.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="member-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="member-email"
                    type="email"
                    autoComplete="off"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="member-role">Role</FieldLabel>
                  <Select
                    items={roleItems}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger id="member-role" aria-invalid={fieldState.invalid} onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>You can only give roles below your own.</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
