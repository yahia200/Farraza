import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  PasswordResetHandler,
  type PasswordResetAccount,
  type PasswordResetLink,
} from '@nestjs/authentication';
import { Mailer, type Mailable } from '@nestjs/mail';
import { UsersRepository } from '../users/users.repository.js';

/** The reset email: `src/mail/templates/password-reset.html` with the link. */
@Injectable()
export class PasswordResetMail implements Mailable<PasswordResetLink> {
  render({ url }: PasswordResetLink) {
    return {
      subject: 'Reset your password',
      template: 'password-reset',
      context: { url },
    };
  }
}

/**
 * Connects @nestjs/authentication's password reset to this app: the package
 * creates and checks the links (PasswordResetService), this finds accounts,
 * sends the links and stores new password hashes. Registers itself under
 * `passwordReset`; the module refuses to start without the matching
 * `passwordReset` option (docs/nestjs/auth.md, "Reset forgotten passwords").
 */
@Injectable()
export class PasswordResetMailer extends PasswordResetHandler {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailer: Mailer,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  /**
   * The account's stored address and password hash. The link goes to that
   * address, never the typed one, and works only while both are unchanged, so
   * any password change invalidates older links. `passwordHash` is null for a
   * Google-only account: a reset then gives it a first password.
   */
  async findUser(email: string): Promise<PasswordResetAccount | null> {
    const found = await this.usersRepository.findCredentials(email);
    return found && { id: found.user.id, email: found.user.email, passwordHash: found.passwordHash };
  }

  async send(link: PasswordResetLink): Promise<void> {
    await this.mailer.send(PasswordResetMail, { to: link.email, data: link });
  }

  updatePassword(userId: string, passwordHash: string): Promise<void> {
    return this.usersRepository.updatePasswordHash(userId, passwordHash);
  }
}
