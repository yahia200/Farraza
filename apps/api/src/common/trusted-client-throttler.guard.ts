import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeIp, ThrottlerGuard } from '@nestjs/throttler';

/** Headers the web app sends with every API call (apps/web/lib/api.ts). */
export const CLIENT_IP_HEADER = 'x-client-ip';
export const INTERNAL_SECRET_HEADER = 'x-internal-secret';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * The global rate limiter, counting each visitor rather than the web server.
 *
 * Every request comes from the Next.js server (on Vercel, without a fixed
 * address), so `req.ip` is the same for everyone. The web app therefore sends
 * the visitor's address in `x-client-ip`, together with a secret only it and
 * the API know (INTERNAL_API_SECRET). The address is used only when the secret
 * matches; anyone calling the API directly is counted by their own connection.
 *
 * Custom trackers: "Proxies" in node_modules/@nestjs/throttler/README.md.
 */
@Injectable()
export class TrustedClientThrottlerGuard extends ThrottlerGuard {
  // Property-based injection, so the parent's constructor stays untouched:
  // https://docs.nestjs.com/providers#property-based-injection
  @Inject(ConfigService) private readonly config!: ConfigService;

  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    if (!this.config.get<string>('INTERNAL_API_SECRET')) {
      this.logger.warn('INTERNAL_API_SECRET is not set: rate limits will count the web server, not each visitor.');
    }
  }

  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const clientIp = this.trustedClientIp(req);
    // Same normalisation as the default tracker (IPv6 addresses grouped by subnet).
    return clientIp ? normalizeIp(clientIp, this.ipv6SubnetPrefix) : super.getTracker(req);
  }

  private trustedClientIp(req: Record<string, any>): string | null {
    const expected = this.config.get<string>('INTERNAL_API_SECRET');
    const secret: unknown = req.headers[INTERNAL_SECRET_HEADER];
    const clientIp: unknown = req.headers[CLIENT_IP_HEADER];
    if (!expected || typeof secret !== 'string' || typeof clientIp !== 'string' || !isIP(clientIp)) {
      return null;
    }
    // Compare fixed-length hashes in constant time, so neither the length nor the
    // content of the secret leaks through response timing.
    return timingSafeEqual(digest(secret), digest(expected)) ? clientIp : null;
  }
}
