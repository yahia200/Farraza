import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  OidcAccountResolver,
  type OAuthTokens,
  type OidcProfile,
  type OidcResolveContext,
} from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

/**
 * `errorCode` of the 403 for a first Google sign-in whose email matches an
 * account that hasn't verified it. The web callback reads it to tell the user
 * to sign in with their password instead.
 */
export const PASSWORD_SIGN_IN_REQUIRED = 'password_sign_in_required';

@Injectable()
export class AccountLinker extends OidcAccountResolver {
  constructor(
    private readonly usersRepository: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('oidc', this);
  }

  async resolveUser(
    profile: OidcProfile,
    _tokens: OAuthTokens,
    { linkTo }: OidcResolveContext,
  ): Promise<User | null> {
    const linked = await this.usersRepository.findByIdentity(profile.provider, profile.subject);

    // Link flow: a signed-in user asked to connect this Google account (the
    // package re-checked their session). No email match is needed.
    if (linkTo) {
      if (linked) {
        if (linked.id !== linkTo.id) {
          throw new ConflictException('This Google account is already connected to another account.');
        }
        return linked;
      }
      if (!(await this.usersRepository.linkIdentity(linkTo.id, profile.provider, profile.subject))) {
        raceConflict();
      }
      return this.usersRepository.findById(linkTo.id);
    }

    // A returning Google account: the user it is linked to.
    if (linked) {
      return linked;
    }

    // First visit. Trust only an address the provider verified, or anyone could
    // create a Google account with someone's email and claim their account here.
    // `null` makes OidcService answer 403.
    if (!profile.email || !profile.emailVerified) {
      return null;
    }
    const identity = { provider: profile.provider, subject: profile.subject };
    const existing = await this.usersRepository.findByEmail(profile.email);
    if (!existing) {
      const created = await this.usersRepository.createWithIdentity(
        { email: profile.email, name: nameFor(profile, profile.email) },
        identity,
      );
      // null: a concurrent callback created the account or the link first.
      return created ?? raceConflict();
    }
    // Link by email only if the account's owner proved the address to us too.
    // Otherwise whoever signed up first with this address and a password of
    // their choosing would share the account with its real owner (account
    // pre-hijacking). They can sign in with the password and connect Google
    // from their account instead (the link flow above).
    if (!existing.emailVerified) {
      throw new ForbiddenException(
        'An account with this email already exists. Sign in with your password, then connect Google from your account.',
        { errorCode: PASSWORD_SIGN_IN_REQUIRED },
      );
    }
    return (await this.usersRepository.linkIdentity(existing.id, identity.provider, identity.subject))
      ? existing
      : raceConflict();
  }
}

function raceConflict(): never {
  throw new ConflictException('This Google account was just linked by another sign-in. Try again.');
}

/**
 * `users.name` is NOT NULL but `profile.name` is optional (the user may not
 * share it): fall back to the email's local part.
 */
function nameFor(profile: OidcProfile, email: string): string {
  return profile.name?.trim() || email.slice(0, email.lastIndexOf('@'));
}
