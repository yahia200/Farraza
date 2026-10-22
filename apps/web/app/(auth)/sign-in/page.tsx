import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { GoogleSignInError } from '@/components/auth/google-sign-in-error';
import { SignInForm } from '@/components/auth/sign-in-form';
import { FieldSeparator } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Sign in · Khatwateen' };

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage your hiring."
      footer={
        <>
          No account yet? <Link href="/sign-up">Create one</Link>
        </>
      }
    >
      {/* searchParams is request data: only this message waits for it. */}
      <Suspense fallback={null}>
        <GoogleSignInError searchParams={searchParams} />
      </Suspense>
      <GoogleSignInButton>Sign in with Google</GoogleSignInButton>
      <FieldSeparator className="my-4">or</FieldSeparator>
      <SignInForm />
    </AuthCard>
  );
}
