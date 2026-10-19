import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { GoogleSignInError } from '@/components/auth/google-sign-in-error';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldSeparator } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Sign in · Khatwateen' };

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Sign in to manage your hiring.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* searchParams is request data: only this message waits for it. */}
        <Suspense fallback={null}>
          <GoogleSignInError searchParams={searchParams} />
        </Suspense>
        <GoogleSignInButton>Sign in with Google</GoogleSignInButton>
        <FieldSeparator className="my-4 *:data-[slot=field-separator-content]:bg-card">or</FieldSeparator>
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
