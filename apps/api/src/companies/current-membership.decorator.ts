import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Membership } from './company.js';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Membership =>
    context.switchToHttp().getRequest().membership,
);