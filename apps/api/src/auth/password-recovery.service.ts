import { BadRequestException, Injectable } from '@nestjs/common';
import { PasswordResetService } from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

const INVALID_LINK = 'This reset link is invalid or has expired.';

/**
 * The app's rules around @nestjs/authentication's PasswordResetService, which
 * creates, mails (through PasswordResetMailer) and checks the reset links
 * (docs/nestjs/auth.md, "Reset forgotten passwords").
 */
@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly passwordReset: PasswordResetService,
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * "Forgot your password?". Returns before the address is looked up: the
   * package finds the account and sends the link afterwards, so the answer and
   * its timing are the same whether or not the address has an account.
   */
  forgot(email: string): void {
    this.passwordReset.request(email);
  }

  /**
   * Sets a new password with a link's token and signs this browser in. The
   * package also ends every other session of the account, invalidates its
   * other reset links and marks the address verified (the link proved it),
   * which is what lets the owner of an address take back an account a
   * stranger registered with it.
   *
   * 400 for an unknown, used or expired token, for a link sent before the
   * address or password changed, and for a password the hasher refuses; the
   * package returns null for all of them without saying which, and the last
   * one leaves the link usable.
   */
  async reset(token: string, password: string): Promise<User> {
    const result = await this.passwordReset.reset(token, password, { signIn: true });
    const user = result && (await this.usersRepository.findById(result.userId));
    if (!user) {
      throw new BadRequestException(INVALID_LINK);
    }
    return user;
  }
}
