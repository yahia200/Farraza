import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { Throttle, minutes } from '@nestjs/throttler';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordDto,
  type ResetPasswordDto,
} from './dto/password-reset.dto.js';
import { PasswordRecoveryService } from './password-recovery.service.js';

/** "Forgot your password?" routes (docs/nestjs/auth.md, "Reset forgotten passwords"). */
@Public()
@Controller('auth/password')
export class PasswordResetController {
  constructor(private readonly recovery: PasswordRecoveryService) {}

  /**
   * 202 for every address, at once: nothing here is awaited, because the
   * account is looked up after the response. Each call can send an email,
   * hence the tighter per-visitor limit.
   */
  @Post('forgot')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: minutes(10) } })
  forgot(@Body({ schema: forgotPasswordSchema }) body: ForgotPasswordDto): void {
    this.recovery.forgot(body.email);
  }

  /**
   * Called by the web app's reset page with the token from the link and the
   * new password (sign-up rules, checked by the schema before the token is
   * touched). Signs this browser in: the session cookie is on the response.
   */
  @Post('reset')
  @HttpCode(200)
  reset(@Body({ schema: resetPasswordSchema }) body: ResetPasswordDto) {
    return this.recovery.reset(body.token, body.password);
  }
}
