import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { EmailVerificationService } from '@nestjs/authentication';
import type { User } from '../users/user.js';

/**
 * The app's rules around @nestjs/authentication's EmailVerificationService,
 * which creates, mails (through EmailVerificationMailer) and checks the links.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly emailVerification: EmailVerificationService) {}

  /**
   * Sends the link right after sign-up. A mail failure is logged, not thrown:
   * by then the account exists and the user is signed in, so failing the
   * request would only make a retry hit "this email already has an account".
   * The dashboard reminder lets them ask for a new link.
   */
  async sendAfterSignUp(user: Pick<User, 'id' | 'email'>): Promise<void> {
    try {
      await this.emailVerification.send(user);
    } catch (error) {
      this.logger.error(`Could not send the verification email to user ${user.id}`, error);
    }
  }

  /**
   * Uses a link's token. 400 for an unknown, used or expired token, and for a
   * link sent to an address the user has changed since: the package's
   * `verify()` returns null for all of them, without saying which.
   */
  async verify(token: string): Promise<{ email: string; emailVerified: true }> {
    const verified = await this.emailVerification.verify(token);
    if (!verified) {
      throw new BadRequestException('This link is invalid or has expired. Ask for a new one.');
    }
    return { email: verified.email, emailVerified: true };
  }

  /** "Send the link again", to the signed-in user's current address. 409 once it's verified. */
  async resend(user: User): Promise<void> {
    if (user.emailVerified) {
      throw new ConflictException('Your email address is already verified.');
    }
    await this.emailVerification.send(user);
  }
}
