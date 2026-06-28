class MemoryRateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, windowMs: number): boolean {
    const now   = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= limit) return false;

    entry.count++;
    return true;
  }
}

const limiter = new MemoryRateLimiter();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  return limiter.check(key, limit, windowMs);
}
