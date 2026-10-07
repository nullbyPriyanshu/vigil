import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';

const MAX_REQUESTS_PER_MINUTE = 100;

@Injectable()
export class RateLimiter {
  constructor(private readonly redis: RedisService) {}

  async getSecondsToWait(keyId: string) {
    const redisKey = `rate-limit:${keyId}`;

    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, 60);
    }

    if (count <= MAX_REQUESTS_PER_MINUTE) {
      return 0;
    }

    const secondsLeft = await this.redis.ttl(redisKey);
    return secondsLeft > 0 ? secondsLeft : 1;
  }
}
