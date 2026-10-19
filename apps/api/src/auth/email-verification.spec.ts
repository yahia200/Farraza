import { join } from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthenticationModule, PasswordHasher } from '@nestjs/authentication';
import { FileTemplateEngine, InMemoryMailTransport, MailModule } from '@nestjs/mail';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';
import { CredentialsService } from './credentials.service.js';
import { EmailVerificationMailer, VerifyEmailMail } from './email-verification.mailer.js';
import { SessionAuth } from './session-auth.provider.js';
import { VerificationService } from './verification.service.js';

// Same pattern as jobs.service.spec.ts: the services under test are the real
// classes, wired to the REAL @nestjs/authentication module (its in-memory token
// and session stores, which it uses outside production) and the REAL
// @nestjs/mail module with an InMemoryMailTransport, so the email and the link
// in it are the ones a user would get. Only the users repository is a
// hand-written in-memory fake.

/** The repository methods these flows use (a Pick, so new methods elsewhere don't break the fake). */
type UsedRepositoryApi = Pick<
  UsersRepository,
  'create' | 'findById' | 'findByEmail' | 'findCredentials' | 'updatePasswordHash' | 'markEmailVerified'
>;

const normalize = (email: string) => email.trim().normalize('NFC').toLowerCase();

class InMemoryUsersRepository implements UsedRepositoryApi {
  private readonly rows = new Map<string, User & { passwordHash: string | null }>();
  private nextId = 1;

  /** Test setup: the user changed their address (no verification flow involved). */
  changeEmail(id: string, email: string): void {
    const row = this.rows.get(id);
    if (row) {
      row.email = normalize(email);
      row.emailVerified = false;
    }
  }

  async create(input: { email: string; name: string; passwordHash: string | null }): Promise<User> {
    const row = {
      id: `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`,
      email: normalize(input.email),
      emailVerified: false,
      name: input.name,
      passwordHash: input.passwordHash,
    };
    this.rows.set(row.id, row);
    return toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = this.rows.get(id);
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = [...this.rows.values()].find((r) => r.email === normalize(email));
    return row ? toUser(row) : null;
  }

  async findCredentials(email: string) {
    const row = [...this.rows.values()].find((r) => r.email === normalize(email));
    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) row.passwordHash = passwordHash;
  }

  /** Mirrors the real conditional update: only while `email` is still the user's address. */
  async markEmailVerified(id: string, email: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.email !== normalize(email)) return false;
    row.emailVerified = true;
    return true;
  }
}

function toUser({ id, email, emailVerified, name }: User): User {
  return { id, email, emailVerified, name };
}

const VERIFY_PAGE = 'http://localhost:3000/verify-email';
const ada = { name: 'Ada Lovelace', email: 'Ada@Example.com', password: 'correct horse battery' };

describe('email verification', () => {
  let moduleRef: TestingModule;
  let users: InMemoryUsersRepository;
  let mailbox: InMemoryMailTransport;
  let credentials: CredentialsService;
  let verification: VerificationService;

  beforeEach(async () => {
    users = new InMemoryUsersRepository();
    mailbox = new InMemoryMailTransport();
    moduleRef = await Test.createTestingModule({
      imports: [
        AuthenticationModule.forRoot({ emailVerification: { url: VERIFY_PAGE } }),
        MailModule.forRoot({
          transport: mailbox,
          // The app's real templates, so a broken template fails here too.
          templates: new FileTemplateEngine({ dir: join(import.meta.dirname, '../mail/templates') }),
          from: 'Khatwateen <accounts@khatwateen.test>',
          retry: false,
        }),
      ],
      providers: [
        SessionAuth,
        CredentialsService,
        EmailVerificationMailer,
        VerificationService,
        { provide: UsersRepository, useValue: users },
      ],
    })
      // scrypt at the default cost is slow on purpose; tests use a cheap one.
      .overrideProvider(PasswordHasher)
      .useValue(new PasswordHasher({ logN: 10 }))
      .compile();
    // Locks the registries, as at app startup: fails if a handler or option is missing.
    await moduleRef.init();
    credentials = moduleRef.get(CredentialsService);
    verification = moduleRef.get(VerificationService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  /** The token in the newest verification email sent to `to`. */
  function tokenSentTo(to: string): string {
    const mail = mailbox.assertSent({ to, mail: VerifyEmailMail });
    const link = mail.link('/verify-email');
    expect(link.origin + link.pathname).toBe(VERIFY_PAGE);
    return link.searchParams.get('token')!;
  }

  describe('sign-up', () => {
    it('creates an unverified account and emails a verification link to it', async () => {
      const user = await credentials.signUp(ada);

      expect(user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com', emailVerified: false });
      expect(tokenSentTo('ada@example.com')).toMatch(/\S{20,}/);
    });

    it('refuses an address that already has an account, and sends nothing', async () => {
      await credentials.signUp(ada);
      mailbox.clear();

      await expect(credentials.signUp({ ...ada, name: 'Someone Else' })).rejects.toBeInstanceOf(ConflictException);
      mailbox.assertNotSent();
    });

    it('still signs the user up when the email cannot be sent', async () => {
      mailbox.failNext(new Error('SMTP server unreachable'));

      const user = await credentials.signUp(ada);

      expect(user.email).toBe('ada@example.com');
      mailbox.assertNotSent();
    });
  });

  describe('verify', () => {
    it('marks the address verified with the link from the sign-up email', async () => {
      const user = await credentials.signUp(ada);

      const verified = await verification.verify(tokenSentTo(user.email));

      expect(verified).toEqual({ email: 'ada@example.com', emailVerified: true });
      expect((await users.findById(user.id))?.emailVerified).toBe(true);
    });

    it('refuses a link that was already used', async () => {
      const user = await credentials.signUp(ada);
      const token = tokenSentTo(user.email);
      await verification.verify(token);

      await expect(verification.verify(token)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a token that was never sent', async () => {
      await credentials.signUp(ada);

      await expect(verification.verify('not-a-real-token')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('verifies nothing when the link went to an address the user has since changed', async () => {
      const user = await credentials.signUp(ada);
      const token = tokenSentTo(user.email);
      users.changeEmail(user.id, 'ada@new-domain.example');

      await expect(verification.verify(token)).rejects.toBeInstanceOf(BadRequestException);
      expect((await users.findById(user.id))?.emailVerified).toBe(false);
    });
  });

  describe('resend', () => {
    it('emails a new working link to the current address', async () => {
      const user = await credentials.signUp(ada);
      mailbox.clear();

      await verification.resend(user);
      await verification.verify(tokenSentTo('ada@example.com'));

      expect((await users.findById(user.id))?.emailVerified).toBe(true);
    });

    it('refuses once the address is verified, and sends nothing', async () => {
      const user = await credentials.signUp(ada);
      await verification.verify(tokenSentTo(user.email));
      mailbox.clear();

      const verifiedUser = (await users.findById(user.id))!;
      await expect(verification.resend(verifiedUser)).rejects.toBeInstanceOf(ConflictException);
      mailbox.assertNotSent();
    });
  });
});
