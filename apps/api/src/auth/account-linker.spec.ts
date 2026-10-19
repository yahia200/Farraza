import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  AuthenticationRegistry,
  type OAuthTokens,
  type OidcProfile,
} from '@nestjs/authentication';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUsersRepository } from '../testing/in-memory-users.repository.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AccountLinker } from './account-linker.js';

// Service-style spec (pattern: src/jobs/jobs.service.spec.ts): the real
// AccountLinker against an in-memory UsersRepository. Assertions go through
// resolveUser() and the fake's public methods, never its internals.

const tokens: OAuthTokens = { accessToken: 'unused' };

function googleProfile(overrides: Partial<OidcProfile> = {}): OidcProfile {
  return {
    provider: 'google',
    subject: 'google-sub-1',
    email: 'ada@example.com',
    emailVerified: true,
    name: 'Ada Lovelace',
    claims: {},
    ...overrides,
  };
}

describe('AccountLinker', () => {
  let users: InMemoryUsersRepository;
  let linker: AccountLinker;

  beforeEach(() => {
    users = new InMemoryUsersRepository();
    linker = new AccountLinker(
      users as unknown as UsersRepository,
      new AuthenticationRegistry(),
    );
  });

  it('signs a returning Google account in as the user it is linked to', async () => {
    const ada = await users.create({ email: 'ada@example.com', name: 'Ada', passwordHash: null });
    await users.linkIdentity(ada.id, 'google', 'google-sub-1');

    const resolved = await linker.resolveUser(googleProfile(), tokens, {});

    expect(resolved?.id).toBe(ada.id);
  });

  describe('first visit with no local account', () => {
    it('creates a verified account named after the Google profile, and links it', async () => {
      const created = await linker.resolveUser(googleProfile(), tokens, {});

      expect(created).toMatchObject({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        emailVerified: true,
      });
      // Linked: the same Google account resolves to it next time.
      expect((await linker.resolveUser(googleProfile(), tokens, {}))?.id).toBe(created?.id);
    });

    it("names the account after the email's local part when Google sends no name", async () => {
      const created = await linker.resolveUser(
        googleProfile({ name: undefined, email: 'grace.hopper@example.com' }),
        tokens,
        {},
      );

      expect(created?.name).toBe('grace.hopper');
    });

    it('treats a blank Google name as no name', async () => {
      const created = await linker.resolveUser(
        googleProfile({ name: '   ', email: 'grace@example.com' }),
        tokens,
        {},
      );

      expect(created?.name).toBe('grace');
    });
  });

  describe('first visit with the email of an existing account', () => {
    it('links to the account when its owner has verified the address too', async () => {
      const ada = await users.create({
        email: 'Ada@Example.com',
        name: 'Ada',
        passwordHash: 'hash',
        emailVerified: true,
      });

      const resolved = await linker.resolveUser(googleProfile(), tokens, {});

      expect(resolved?.id).toBe(ada.id);
      expect(resolved?.name).toBe('Ada'); // the account keeps its own name
      expect((await users.findByIdentity('google', 'google-sub-1'))?.id).toBe(ada.id);
    });

    it('refuses (403) when the account has not verified the address, and links nothing', async () => {
      await users.create({ email: 'ada@example.com', name: 'Ada', passwordHash: 'hash' });

      const attempt = linker.resolveUser(googleProfile(), tokens, {});

      await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
      await expect(attempt).rejects.toMatchObject({
        response: { errorCode: 'password_sign_in_required' },
      });
      expect(await users.findByIdentity('google', 'google-sub-1')).toBeNull();
    });
  });

  describe('link flow ("connect Google" while signed in)', () => {
    it('attaches the Google account to the signed-in user, whatever its email', async () => {
      const ada = await users.create({ email: 'ada@work.example', name: 'Ada', passwordHash: 'hash' });

      const resolved = await linker.resolveUser(
        googleProfile({ email: 'ada.personal@gmail.example', emailVerified: false }),
        tokens,
        { linkTo: { id: ada.id } },
      );

      expect(resolved?.id).toBe(ada.id);
      expect((await linker.resolveUser(googleProfile(), tokens, {}))?.id).toBe(ada.id);
    });

    it('accepts a Google account already linked to the same user', async () => {
      const ada = await users.create({ email: 'ada@example.com', name: 'Ada', passwordHash: 'hash' });
      await users.linkIdentity(ada.id, 'google', 'google-sub-1');

      const resolved = await linker.resolveUser(googleProfile(), tokens, { linkTo: { id: ada.id } });

      expect(resolved?.id).toBe(ada.id);
    });

    it('conflicts (409) when the Google account belongs to someone else', async () => {
      const owner = await users.create({ email: 'owner@example.com', name: 'Owner', passwordHash: null });
      await users.linkIdentity(owner.id, 'google', 'google-sub-1');
      const other = await users.create({ email: 'other@example.com', name: 'Other', passwordHash: 'hash' });

      await expect(
        linker.resolveUser(googleProfile(), tokens, { linkTo: { id: other.id } }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await users.findByIdentity('google', 'google-sub-1'))?.id).toBe(owner.id);
    });
  });

  describe('first visit with an address Google has not verified', () => {
    it('refuses, and creates no account', async () => {
      const resolved = await linker.resolveUser(googleProfile({ emailVerified: false }), tokens, {});

      expect(resolved).toBeNull();
      expect(await users.findByEmail('ada@example.com')).toBeNull();
    });

    it('refuses to link to an existing verified account', async () => {
      await users.create({
        email: 'ada@example.com',
        name: 'Ada',
        passwordHash: 'hash',
        emailVerified: true,
      });

      const resolved = await linker.resolveUser(googleProfile({ emailVerified: false }), tokens, {});

      expect(resolved).toBeNull();
    });

    it('refuses a Google account that shares no email', async () => {
      const resolved = await linker.resolveUser(googleProfile({ email: undefined }), tokens, {});

      expect(resolved).toBeNull();
    });
  });
});
