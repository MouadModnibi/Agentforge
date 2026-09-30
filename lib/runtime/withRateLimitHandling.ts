export interface RateLimitError {
  isRateLimit: boolean;
  retryAfterMs: number;
  message: string;
}

function isRateLimitError(error: unknown): { isRateLimit: boolean; retryAfterMs: number } {
  if (!error || typeof error !== "object") return { isRateLimit: false, retryAfterMs: 0 };

  const err = error as Record<string, unknown>;
  const message = String(err.message || "").toLowerCase();
  const statusCode = Number(err.status || err.statusCode || 0);

  const isRateLimit =
    statusCode === 429 ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted") ||
    message.includes("429");

  if (!isRateLimit) return { isRateLimit: false, retryAfterMs: 0 };

  // Try to parse Retry-After
  const retryAfter = (err as Record<string, unknown>).retryAfter;
  const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 0;

  return { isRateLimit: true, retryAfterMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms + Math.random() * ms * 0.3;
}

export async function withRateLimitHandling<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const { isRateLimit, retryAfterMs } = isRateLimitError(error);

      if (!isRateLimit) {
        throw error;
      }

      if (attempt === maxAttempts - 1) {
        const waitSec = Math.ceil((retryAfterMs || 60000) / 1000);
        throw new Error(
          `Gemini free-tier quota reached. Retry in ~${waitSec}s. ` +
          `Consider spacing out your requests or enabling billing in Google AI Studio.`
        );
      }

      // Exponential backoff with jitter
      const baseDelay = retryAfterMs || Math.pow(2, attempt) * 2000;
      const delay = jitter(baseDelay);
      console.log(`Rate limit hit, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxAttempts})`);
      await sleep(delay);
    }
  }

  throw lastError;
}
