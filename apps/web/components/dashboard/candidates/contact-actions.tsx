import { MailIcon, PhoneIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Quick actions to call or email a candidate, as plain links: `tel:` opens the
 * phone or calling app, `mailto:` the mail app. The phone is stored in E.164
 * (`+201000000000`), which `tel:` accepts as is. Used in the table's Contact
 * column and on the board card, outside the card's drag-handle link.
 */
export function ContactActions({
  name,
  email,
  phone,
  className,
}: {
  name: string;
  email: string;
  phone: string;
  className?: string;
}) {
  const linkClass = buttonVariants({ variant: 'ghost', size: 'icon-xs' });
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <a href={`tel:${phone}`} aria-label={`Call ${name}`} title={`Call ${phone}`} className={linkClass}>
        <PhoneIcon />
      </a>
      <a href={`mailto:${email}`} aria-label={`Email ${name}`} title={`Email ${email}`} className={linkClass}>
        <MailIcon />
      </a>
    </div>
  );
}
