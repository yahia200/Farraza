import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { FieldSeparator } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Create account · Farraza' };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Start building your hiring pipeline."
      footer={
        <>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </>
      }
    >
      <GoogleSignInButton>Sign up with Google</GoogleSignInButton>
      <FieldSeparator className="my-4">or</FieldSeparator>
      <SignUpForm />
    </AuthCard>
  );
}
