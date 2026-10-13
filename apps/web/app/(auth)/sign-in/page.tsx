import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Sign in · Khatwateen' };

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Sign in to manage your hiring.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        No account yet?&nbsp;
        <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
      </CardFooter>
    </Card>
  );
}
