import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from 'src/prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    let db = 'up';
    let redis = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }

    try {
      await this.redis.ping();
    } catch {
      redis = 'down';
    }

    if (db === 'down' || redis === 'down') {
      res.status(503);
      return { status: 'degraded', db, redis };
    }

    return {
      status: 'ok',
      db,
      redis,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
