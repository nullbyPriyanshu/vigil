import { RedisService } from '../redis/redis.service';
import { RateLimiter } from './rateLimiter';

jest.mock('../redis/redis.service', () => ({ RedisService: class {} }));

describe('RateLimiter', () => {
  let counts: Record<string, number>;
  let redis: { incr: jest.Mock; expire: jest.Mock; ttl: jest.Mock };
  let limiter: RateLimiter;

  beforeEach(() => {
    counts = {};
    redis = {
      incr: jest.fn((key: string) => {
        counts[key] = (counts[key] ?? 0) + 1;
        return counts[key];
      }),
      expire: jest.fn(),
      ttl: jest.fn().mockResolvedValue(40),
    };
    limiter = new RateLimiter(redis as unknown as RedisService);
  });

  it('allows 100 requests a minute, then says how long to wait', async () => {
    for (let i = 0; i < 100; i++) {
      expect(await limiter.getSecondsToWait('k1')).toBe(0);
    }

    expect(await limiter.getSecondsToWait('k1')).toBe(40);
  });

  it('starts the one-minute timer on the first request only', async () => {
    await limiter.getSecondsToWait('k1');
    await limiter.getSecondsToWait('k1');

    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith('rate-limit:k1', 60);
  });

  it('counts each key separately', async () => {
    for (let i = 0; i < 101; i++) await limiter.getSecondsToWait('k1');

    expect(await limiter.getSecondsToWait('k2')).toBe(0);
  });
});
