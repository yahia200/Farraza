import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type OidcStateStore,
  type OidcTransaction,
} from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Google logins in progress (PKCE verifier, nonce, return path), kept in the
 * `oidc_states` table between the redirect to Google and the callback.
 * Contract: OidcStateStore in @nestjs/authentication and docs/nestjs/auth.md,
 * "The store contract".
 */
@Injectable()
export class PrismaOidcStateStore implements OidcStateStore {
  /**
   * Pending logins kept at most; past it, those that expire first go. Bounds
   * the table against a flood of login starts (the guide's value, auth.md
   * "Keep sessions and tokens in your database").
   */
  protected readonly maxPending: number = 100_000;

  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ oidcStates: this });
  }

  private get states() {
    return this.prisma.db.orm.public.OidcState;
  }

  async saveOidcState({ link, ...login }: OidcTransaction): Promise<void> {
    await this.states.create({
      state: login.state,
      provider: login.provider,
      nonce: login.nonce ?? null,
      codeVerifier: login.codeVerifier,
      redirectTo: login.redirectTo ?? null,
      linkUserId: link?.userId ?? null,
      linkSessionId: link?.sessionId ?? null,
      createdAt: login.createdAt,
      expiresAt: login.expiresAt,
    });
    await this.trim(login.createdAt);
  }

  async consumeOidcState(state: string): Promise<OidcTransaction | undefined> {
    // One DELETE ... RETURNING, so a callback replayed in parallel gets the
    // transaction once (deleteAll() compiles to a single statement).
    const [row] = await this.states.where({ state }).deleteAll();
    return row ? toTransaction(row) : undefined;
  }

  /** Deletes what expired, and past `maxPending`, what expires first. */
  private async trim(now: Date): Promise<void> {
    await this.states.where((s) => s.expiresAt.lte(now)).deleteAndCount();
    const cutoff = await this.states
      .select('expiresAt')
      .orderBy((s) => s.expiresAt.desc())
      .offset(this.maxPending)
      .first();
    if (cutoff) {
      await this.states.where((s) => s.expiresAt.lte(cutoff.expiresAt)).deleteAndCount();
    }
  }
}

/** Optional fields come back absent, never null: the contract compares records deep-equal. */
function toTransaction(row: {
  state: string;
  provider: string;
  nonce: string | null;
  codeVerifier: string;
  redirectTo: string | null;
  linkUserId: string | null;
  linkSessionId: string | null;
  createdAt: Date;
  expiresAt: Date;
}): OidcTransaction {
  return {
    state: row.state,
    provider: row.provider,
    codeVerifier: row.codeVerifier,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ...(row.nonce !== null && { nonce: row.nonce }),
    ...(row.redirectTo !== null && { redirectTo: row.redirectTo }),
    ...(row.linkUserId !== null &&
      row.linkSessionId !== null && {
        link: { userId: row.linkUserId, sessionId: row.linkSessionId },
      }),
  };
}
