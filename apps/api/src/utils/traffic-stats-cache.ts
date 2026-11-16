import type { TrafficStatsCachePort, TrafficStatsCacheSetInput } from '@repo/service-core';
import { apiLogger } from './logger';
import { getRedisClient } from './redis';

/**
 * Creates the Redis-backed cache adapter for listing traffic stats.
 *
 * Keys are stored exactly as received: the service builds them with
 * `buildListingTrafficStatsCacheKey` (`traffic-stats:{type}:{id}:{window}`), so
 * this adapter adds no prefix. Values are JSON-serialized and written with
 * `SETEX` using the caller's TTL.
 *
 * The cache is strictly best-effort. When Redis is not configured, or any
 * operation throws (client resolution, `get`, `setex`, `JSON.parse` of a
 * corrupted value), `get` degrades to a miss (`null`) and `set` to a no-op,
 * logging a warning. It never throws and adds no timeout of its own: the
 * service bounds cache reads.
 *
 * @returns A {@link TrafficStatsCachePort} backed by the shared Redis client
 *
 * @example
 * ```ts
 * const cache = createApiTrafficStatsCache();
 * await cache.set({ key: 'traffic-stats:ACCOMMODATION:<id>:30d', value: stats, ttlSeconds: 3600 });
 * const hit = await cache.get('traffic-stats:ACCOMMODATION:<id>:30d');
 * ```
 */
export function createApiTrafficStatsCache(): TrafficStatsCachePort {
    return {
        async get(key: string): Promise<unknown | null> {
            try {
                const client = await getRedisClient();
                if (!client) return null;
                const raw = await client.get(key);
                if (raw === null || raw === undefined) return null;
                return JSON.parse(raw) as unknown;
            } catch (error) {
                apiLogger.warn({
                    message: 'Traffic stats cache read failed; treating as miss',
                    error: error instanceof Error ? error.message : String(error),
                    key
                });
                return null;
            }
        },

        async set(input: TrafficStatsCacheSetInput): Promise<void> {
            const { key, value, ttlSeconds } = input;
            try {
                const client = await getRedisClient();
                if (!client) return;
                await client.setex(key, ttlSeconds, JSON.stringify(value));
            } catch (error) {
                apiLogger.warn({
                    message: 'Traffic stats cache write failed; skipping',
                    error: error instanceof Error ? error.message : String(error),
                    key
                });
            }
        }
    };
}
