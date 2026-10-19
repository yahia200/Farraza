import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { Public, SignInService } from '@nestjs/authentication';
import { signInSchema, signUpSchema, type SignInDto, type SignUpDto } from './dto/auth.dto.js';
import { CredentialsService } from './credentials.service.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
  ) { }

  /** Creates the account, signs in, and emails a verification link (CredentialsService.signUp). */
  @Post('sign-up')
  signUp(@Body({ schema: signUpSchema }) body: SignUpDto) {
    return this.credentialsService.signUp(body);
  }

  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body({ schema: signInSchema }) body: SignInDto) {
    const user = await this.credentialsService.verify(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException("That email and password don't match an account.");
    }
    await this.signInService.signIn(user.id, { method: 'password' });
    return user;
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut() {
    if (!(await this.signInService.signOut())) {
      throw new UnauthorizedException();
    }
  }
}