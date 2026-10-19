import { ConflictException, Injectable } from '@nestjs/common';
import { PasswordHasher, SignInService } from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';
import type { SignUpDto } from './dto/auth.dto.js';
import { VerificationService } from './verification.service.js';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly signInService: SignInService,
    private readonly verification: VerificationService,
  ) {}

  /**
   * Creates the account, signs this browser in, then emails a link that
   * proves the address (docs/nestjs/auth.md, "Verify email addresses").
   * Nothing waits on verification: the user carries on to onboarding.
   */
  async signUp({ name, email, password }: SignUpDto): Promise<User> {
    const user = await this.register(name, email, password);
    await this.signInService.signIn(user.id, { method: 'password' });
    await this.verification.sendAfterSignUp(user);
    return user;
  }

  async register(name: string, email: string, password: string): Promise<User> {
    if (await this.usersRepository.findByEmail(email)) {
      throw new ConflictException('An account with this email already exists. Try signing in instead.');
    }
    return this.usersRepository.create({
      name,
      email,
      passwordHash: await this.passwordHasher.hash(password),
    });
  }

  async verify(email: string, password: string): Promise<User | null> {
    const found = await this.usersRepository.findCredentials(email);
    const valid = await this.passwordHasher.verify(password, found?.passwordHash);
    if (!valid || !found?.passwordHash) {
      return null;
    }
    if (this.passwordHasher.needsRehash(found.passwordHash)) {
      await this.usersRepository.updatePasswordHash(found.user.id, await this.passwordHasher.hash(password));
    }
    return found.user;
  }
}