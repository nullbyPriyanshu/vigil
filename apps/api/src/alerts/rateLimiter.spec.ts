import { RATE_LIMIT, RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  it('allows 100 requests a minute, then says how long to wait', () => {
    const limiter = new RateLimiter();
    const start = 1_000_000;

    for (let i = 0; i < RATE_LIMIT; i++) {
      expect(limiter.check('k1', start + i)).toBe(0);
    }
    // 20 seconds into the minute: 40 seconds left.
    expect(limiter.check('k1', start + 20_000)).toBe(40);
  });

  it('counts each key separately', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < RATE_LIMIT; i++) limiter.check('k1', 0);

    expect(limiter.check('k1', 1)).toBeGreaterThan(0);
    expect(limiter.check('k2', 1)).toBe(0);
  });

  it('starts fresh once the minute is over', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i <= RATE_LIMIT; i++) limiter.check('k1', 0);

    expect(limiter.check('k1', 60_000)).toBe(0);
  });
});
