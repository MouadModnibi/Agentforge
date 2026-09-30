interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

export function checkRateLimit(
  key: string,
  maxPerMinute: number = 60
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: maxPerMinute, lastRefill: now };

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillAmount = (elapsed / 60000) * maxPerMinute;
  bucket.tokens = Math.min(maxPerMinute, bucket.tokens + refillAmount);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    const retryAfterMs = Math.ceil((1 - bucket.tokens) / (maxPerMinute / 60000));
    buckets.set(key, bucket);
    return { allowed: false, retryAfterMs };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}

// Cleanup old buckets every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.lastRefill < cutoff) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);
