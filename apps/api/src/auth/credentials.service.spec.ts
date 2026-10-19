import { ConflictException } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUsersRepository } from '../testing/in-memory-users.repository.js';
import type { UsersRepository } from '../users/users.repository.js';
import { CredentialsService } from './credentials.service.js';

// Service-style spec (pattern: src/jobs/jobs.service.spec.ts): the real
// CredentialsService and PasswordHasher against an in-memory UsersRepository.

describe('CredentialsService', () => {
  let users: InMemoryUsersRepository;
  let credentials: CredentialsService;

  beforeEach(() => {
    users = new InMemoryUsersRepository();
    credentials = new CredentialsService(users as unknown as UsersRepository, new PasswordHasher());
  });

  describe('register', () => {
    it('creates an unverified account with the given name that signs in with its password', async () => {
      const user = await credentials.register('Ada Lovelace', 'Ada@Example.com', 'correct horse battery');

      expect(user).toMatchObject({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        emailVerified: false,
      });
      expect((await credentials.verify('ada@example.com', 'correct horse battery'))?.id).toBe(user.id);
      expect(await credentials.verify('ada@example.com', 'wrong password!!')).toBeNull();
    });

    it('conflicts (409) when the email already has an account, whatever its case', async () => {
      await credentials.register('Ada', 'ada@example.com', 'correct horse battery');

      await expect(
        credentials.register('Someone Else', 'ADA@example.com', 'another long password'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('conflicts for an address already taken by a Google-only account', async () => {
      await users.createWithIdentity(
        { email: 'grace@example.com', name: 'Grace' },
        { provider: 'google', subject: 'google-sub-2' },
      );

      await expect(
        credentials.register('Grace', 'grace@example.com', 'correct horse battery'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
