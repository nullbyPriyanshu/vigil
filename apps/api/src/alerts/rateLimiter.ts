import { Injectable } from '@nestjs/common';

export const RATE_LIMIT = 100;
export const RATE_WINDOW_MS = 60 * 1000;

// Lets each API key send RATE_LIMIT alerts a minute. The counts live in
// this process's memory, which is fine for one server. With several
// servers they'd each count separately, and this should move to Redis.
@Injectable()
export class RateLimiter {
  // key id -> when its current minute started, and how many requests so far.
  private readonly windows = new Map<
    string,
    { startedAt: number; count: number }
  >();

  // Counts one request. Returns 0 when it's allowed, otherwise how many
  // seconds the caller should wait.
  check(keyId: string, now = Date.now()): number {
    const window = this.windows.get(keyId);

    // First request, or the last minute is over: start a new one.
    if (!window || now - window.startedAt >= RATE_WINDOW_MS) {
      this.windows.set(keyId, { startedAt: now, count: 1 });
      return 0;
    }

    if (window.count < RATE_LIMIT) {
      window.count += 1;
      return 0;
    }

    const msLeft = window.startedAt + RATE_WINDOW_MS - now;
    return Math.max(1, Math.ceil(msLeft / 1000));
  }
}
