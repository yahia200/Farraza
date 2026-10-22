import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * The frame every (auth) page renders: a borderless card with a centered
 * heading, like shadcn's login blocks (`shadcn view login-03`). The title is
 * the page's <h1>, nested in CardTitle (a div) so the header keeps its slots.
 * Links in `footer` are styled here, the way shadcn's FieldDescription styles
 * its own, so pages pass a plain <Link>.
 */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card ghost>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter className="justify-center text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <p>{footer}</p>
        </CardFooter>
      )}
    </Card>
  );
}
