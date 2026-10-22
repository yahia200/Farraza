import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Forgot your password · Khatwateen' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we'll send you a link to choose a new one."
      footer={
        <>
          Remembered it? <Link href="/sign-in">Sign in</Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
