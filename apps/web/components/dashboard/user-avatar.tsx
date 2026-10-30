import BoringAvatar from 'boring-avatars';
import { Avatar } from '@/components/ui/avatar';

/**
 * The brand palette as hex, because Boring Avatars takes hex strings, not CSS
 * variables. From globals.css: --primary-200, -400, -500, -700, --brand-accent and
 * --success (oklch converted to sRGB). The red is not a token: it is
 * oklch(0.66 0.16 22), --destructive softened to sit between the coral and the
 * indigos. Change both together.
 */
const PALETTE = ['#6d7fea', '#11c97e', '#4a62e6', '#2e3fa6', '#ff9b85', '#e36364'];

/**
 * A generated avatar (https://boringavatars.com/react, `boring-avatars` 2.0.4).
 * `seed` should be the user's id: it never changes, so neither does the picture.
 * The name is always shown beside it, so the SVG is hidden from screen readers.
 * `size-full!` is important on purpose: SidebarMenuButton sizes every descendant
 * svg to 16px (`[&_svg]:size-4`, for icons), which would shrink the avatar in the
 * account menu's trigger.
 */
export function UserAvatar({ seed, className }: { seed: string; className?: string }) {
  return (
    <Avatar className={className}>
      <BoringAvatar name={seed} variant="beam" colors={PALETTE} size="100%" className="size-full!" aria-hidden />
    </Avatar>
  );
}
