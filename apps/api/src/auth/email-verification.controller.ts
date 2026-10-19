import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, Public } from '@nestjs/authentication';
import { Throttle, minutes } from '@nestjs/throttler';
import type { User } from '../users/user.js';
import { verifyEmailSchema, type VerifyEmailDto } from './dto/verify-email.dto.js';
import { VerificationService } from './verification.service.js';

/** Email verification routes (docs/nestjs/auth.md, "Verify email addresses"). */
@Controller('auth/email')
export class EmailVerificationController {
  constructor(private readonly verification: VerificationService) {}

  /**
   * Called by the web app's verify page, which POSTs the token from the link:
   * mail scanners and link previews follow links with GET, and would use it up.
   */
  @Public()
  @Post('verify')
  @HttpCode(200)
  verify(@Body({ schema: verifyEmailSchema }) body: VerifyEmailDto) {
    return this.verification.verify(body.token);
  }

  /**
   * "Send the link again", to the signed-in user's own address, so it reveals
   * nothing about other accounts. Each call sends an email, hence the tighter
   * per-visitor limit.
   */
  @Post('verification')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: minutes(10) } })
  async resend(@CurrentUser() user: User): Promise<void> {
    await this.verification.resend(user);
  }
}
