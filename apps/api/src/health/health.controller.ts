import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '@nestjs/authentication';

@Public()
@Controller('health')
export class HealthController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    async getHealth() {
        await this.prisma.db.orm.public.User.limit(1).all();
        return 'OK';
    }
}
