import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  EmailVerificationHandler,
  type EmailVerificationLink,
} from '@nestjs/authentication';
import { Mailer, type Mailable } from '@nestjs/mail';
import { UsersRepository } from '../users/users.repository.js';

/** The verification email: `src/mail/templates/verify-email.html` with the link. */
@Injectable()
export class VerifyEmailMail implements Mailable<EmailVerificationLink> {
  render({ url }: EmailVerificationLink) {
    return {
      subject: 'Confirm your email address',
      template: 'verify-email',
      context: { url },
    };
  }
}

/**
 * Connects @nestjs/authentication's email verification to this app: the
 * package creates and checks the links (EmailVerificationService), this sends
 * them and records a verified address. Registers itself under
 * `emailVerification`; the module refuses to start without the matching
 * `emailVerification` option (docs/nestjs/auth.md, "Verify email addresses").
 */
@Injectable()
export class EmailVerificationMailer extends EmailVerificationHandler {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailer: Mailer,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('emailVerification', this);
  }

  async send(link: EmailVerificationLink): Promise<void> {
    await this.mailer.send(VerifyEmailMail, { to: link.email, data: link });
  }

  /** Runs when a link is used. Verifies nothing if the address changed since it was sent. */
  markVerified(userId: string, email: string): Promise<boolean> {
    return this.usersRepository.markEmailVerified(userId, email);
  }
}
