import type { Metadata } from 'next';
import Link from 'next/link';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { FieldSeparator } from '@/components/ui/field';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Create account · Khatwateen' };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start building your hiring pipeline.</CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleSignInButton>Sign up with Google</GoogleSignInButton>
        <FieldSeparator className="my-4 *:data-[slot=field-separator-content]:bg-card">or</FieldSeparator>
        <SignUpForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
