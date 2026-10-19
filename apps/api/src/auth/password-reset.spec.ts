import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { AuthenticationModule, PasswordHasher, SessionService } from '@nestjs/authentication';
import { FileTemplateEngine, InMemoryMailTransport, MailModule } from '@nestjs/mail';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUsersRepository } from '../testing/in-memory-users.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { CredentialsService } from './credentials.service.js';
import { EmailVerificationMailer } from './email-verification.mailer.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { PasswordResetMail, PasswordResetMailer } from './password-reset.mailer.js';
import { SessionAuth } from './session-auth.provider.js';
import { VerificationService } from './verification.service.js';

// Same pattern as email-verification.spec.ts: the real @nestjs/authentication
// module (its in-memory token and session stores, used outside production),
// the real @nestjs/mail module with an InMemoryMailTransport and the app's
// templates, and the hand-written in-memory users repository.

const RESET_PAGE = 'http://localhost:3000/reset-password';
const ada = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct horse battery' };
const NEW_PASSWORD = 'a brand new passphrase';

describe('password reset', () => {
  let moduleRef: TestingModule;
  let users: InMemoryUsersRepository;
  let mailbox: InMemoryMailTransport;
  let credentials: CredentialsService;
  let recovery: PasswordRecoveryService;
  let sessions: SessionService;
  let hasher: PasswordHasher;
  /** The clock the reset links are dated with, in epoch milliseconds. */
  let now: number;

  beforeEach(async () => {
    users = new InMemoryUsersRepository();
    mailbox = new InMemoryMailTransport();
    now = Date.parse('2026-10-19T09:00:00Z');
    moduleRef = await Test.createTestingModule({
      imports: [
        AuthenticationModule.forRoot({
          // Reset marks the address verified through the emailVerification handler.
          emailVerification: { url: 'http://localhost:3000/verify-email' },
          passwordReset: { url: RESET_PAGE, now: () => now },
        }),
        MailModule.forRoot({
          transport: mailbox,
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
        PasswordResetMailer,
        PasswordRecoveryService,
        { provide: UsersRepository, useValue: users },
      ],
    })
      .overrideProvider(PasswordHasher)
      .useValue(new PasswordHasher({ logN: 10 }))
      .compile();
    await moduleRef.init();
    credentials = moduleRef.get(CredentialsService);
    recovery = moduleRef.get(PasswordRecoveryService);
    sessions = moduleRef.get(SessionService);
    hasher = moduleRef.get(PasswordHasher);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  /**
   * The token in the newest reset email to `to`. The email goes out after
   * `forgot()` has returned, so this waits for it.
   */
  async function resetTokenSentTo(to: string): Promise<string> {
    const mail = await vi.waitFor(() => mailbox.assertSent({ to, mail: PasswordResetMail }));
    const link = mail.link('/reset-password');
    expect(link.origin + link.pathname).toBe(RESET_PAGE);
    return link.searchParams.get('token')!;
  }

  describe('forgot', () => {
    it('emails a reset link to the address the account has stored', async () => {
      await credentials.register(ada.name, ada.email, ada.password);

      recovery.forgot('  ADA@Example.COM ');

      expect(await resetTokenSentTo('ada@example.com')).toMatch(/\S{20,}/);
    });

    it('answers before looking the address up, and sends nothing for an address without an account', async () => {
      await credentials.register(ada.name, ada.email, ada.password);

      expect(recovery.forgot('nobody@example.com')).toBeUndefined();
      expect(recovery.forgot(ada.email)).toBeUndefined();
      // Both calls have returned, and no lookup has happened yet: nothing is sent.
      mailbox.assertNotSent();

      await resetTokenSentTo(ada.email);
      expect(mailbox.mails).toHaveLength(1);
      mailbox.assertNotSent({ to: 'nobody@example.com' });
    });
  });

  describe('reset', () => {
    it('sets the new password, signs this browser in and ends every other session', async () => {
      const user = await credentials.register(ada.name, ada.email, ada.password);
      const elsewhere = await sessions.create(user.id);
      recovery.forgot(ada.email);

      const signedIn = await recovery.reset(await resetTokenSentTo(ada.email), NEW_PASSWORD);

      expect(signedIn).toMatchObject({ id: user.id, email: 'ada@example.com' });
      expect(await sessions.validate(elsewhere.token)).toBeNull();
      expect((await sessions.list(user.id)).map((s) => s.userId)).toEqual([user.id]);
      expect(await credentials.verify(ada.email, NEW_PASSWORD)).toMatchObject({ id: user.id });
      expect(await credentials.verify(ada.email, ada.password)).toBeNull();
    });

    it('marks the address verified: the link proved it', async () => {
      const user = await credentials.register(ada.name, ada.email, ada.password);
      recovery.forgot(ada.email);

      const signedIn = await recovery.reset(await resetTokenSentTo(ada.email), NEW_PASSWORD);

      expect(signedIn.emailVerified).toBe(true);
      expect((await users.findById(user.id))?.emailVerified).toBe(true);
    });

    it('works once', async () => {
      await credentials.register(ada.name, ada.email, ada.password);
      recovery.forgot(ada.email);
      const token = await resetTokenSentTo(ada.email);
      await recovery.reset(token, NEW_PASSWORD);

      await expect(recovery.reset(token, 'yet another passphrase')).rejects.toBeInstanceOf(BadRequestException);
      expect(await credentials.verify(ada.email, NEW_PASSWORD)).not.toBeNull();
    });

    it('refuses a link older than an hour', async () => {
      await credentials.register(ada.name, ada.email, ada.password);
      recovery.forgot(ada.email);
      const token = await resetTokenSentTo(ada.email);

      now += 61 * 60 * 1000;

      await expect(recovery.reset(token, NEW_PASSWORD)).rejects.toBeInstanceOf(BadRequestException);
      expect(await credentials.verify(ada.email, ada.password)).not.toBeNull();
    });

    it('refuses a token that was never sent', async () => {
      await expect(recovery.reset('not-a-real-token', NEW_PASSWORD)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps the link usable when the password is refused', async () => {
      await credentials.register(ada.name, ada.email, ada.password);
      recovery.forgot(ada.email);
      const token = await resetTokenSentTo(ada.email);

      // PasswordHasher refuses an empty password (the app's own rules are the
      // shared schema's, checked by the validation pipe before this runs).
      await expect(recovery.reset(token, '')).rejects.toBeInstanceOf(BadRequestException);

      await recovery.reset(token, NEW_PASSWORD);
      expect(await credentials.verify(ada.email, NEW_PASSWORD)).not.toBeNull();
    });

    it('refuses links sent before the password changed', async () => {
      const user = await credentials.register(ada.name, ada.email, ada.password);
      recovery.forgot(ada.email);
      const token = await resetTokenSentTo(ada.email);
      // A password change by any route (there is no change-password page yet).
      await users.updatePasswordHash(user.id, await hasher.hash('changed in the meantime'));

      await expect(recovery.reset(token, NEW_PASSWORD)).rejects.toBeInstanceOf(BadRequestException);
      expect(await credentials.verify(ada.email, 'changed in the meantime')).not.toBeNull();
    });

    it('takes over an account a stranger registered with the address', async () => {
      // Someone signs up with Ada's address before she does, and stays signed in.
      const stranger = await credentials.register('Not Ada', ada.email, 'the stranger knows this');
      const strangersSession = await sessions.create(stranger.id);

      recovery.forgot(ada.email);
      const signedIn = await recovery.reset(await resetTokenSentTo(ada.email), NEW_PASSWORD);

      expect(signedIn).toMatchObject({ id: stranger.id, emailVerified: true });
      expect(await sessions.validate(strangersSession.token)).toBeNull();
      expect(await credentials.verify(ada.email, 'the stranger knows this')).toBeNull();
      expect(await credentials.verify(ada.email, NEW_PASSWORD)).not.toBeNull();
    });
  });
});
