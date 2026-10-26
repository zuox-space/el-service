/**
 * Небольшой in-memory rate limiter для тяжёлых и чувствительных API.
 *
 * Приложение разворачивается в одном контейнере (SSE ключей тоже in-memory),
 * поэтому локального счётчика достаточно. При переходе на несколько реплик
 * заменить на Redis/Upstash.
 */
interface Bucket {
    count: number;
    resetAt: number;
}

const globalForRateLimit = globalThis as typeof globalThis & {
    __rateLimitBuckets?: Map<string, Bucket>;
};

const buckets = (globalForRateLimit.__rateLimitBuckets ??= new Map());

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfter: number;
}

export function consumeRateLimit(
    key: string,
    limit: number,
    windowMs: number,
): RateLimitResult {
    const now = Date.now();

    // Периодически чистим старые ключи, чтобы карта не росла бесконечно.
    if (buckets.size > 5_000) {
        for (const [bucketKey, bucket] of buckets) {
            if (bucket.resetAt <= now) buckets.delete(bucketKey);
        }
    }

    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfter: 0 };
    }

    current.count += 1;

    if (current.count > limit) {
        return {
            allowed: false,
            remaining: 0,
            retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
        };
    }

    return {
        allowed: true,
        remaining: Math.max(0, limit - current.count),
        retryAfter: 0,
    };
}
