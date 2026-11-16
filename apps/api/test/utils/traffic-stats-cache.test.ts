import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiLogger } from '../../src/utils/logger';
import { getRedisClient } from '../../src/utils/redis';
import { createApiTrafficStatsCache } from '../../src/utils/traffic-stats-cache';

vi.mock('../../src/utils/redis', () => ({ getRedisClient: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const KEY = 'traffic-stats:ACCOMMODATION:11111111-1111-4111-8111-111111111111:30d';

/** Builds a fake Redis client exposing only the commands the adapter uses. */
function fakeRedis() {
    return {
        get: vi.fn<(key: string) => Promise<string | null>>().mockResolvedValue(null),
        setex: vi
            .fn<(key: string, ttl: number, value: string) => Promise<'OK'>>()
            .mockResolvedValue('OK')
    };
}

function useRedis(client: ReturnType<typeof fakeRedis> | undefined): void {
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
}

describe('createApiTrafficStatsCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stores under the exact key with setex and the given TTL', async () => {
        const redis = fakeRedis();
        useRedis(redis);

        await createApiTrafficStatsCache().set({ key: KEY, value: { a: 1 }, ttlSeconds: 3600 });

        expect(redis.setex).toHaveBeenCalledWith(KEY, 3600, JSON.stringify({ a: 1 }));
    });

    it('reads from the exact key', async () => {
        const redis = fakeRedis();
        useRedis(redis);

        await createApiTrafficStatsCache().get(KEY);

        expect(redis.get).toHaveBeenCalledWith(KEY);
    });

    it('round-trips a JSON value', async () => {
        const value = { views: 3, referrers: [{ value: 'google', count: 2 }] };
        const redis = fakeRedis();
        redis.get.mockImplementation(async () => JSON.stringify(value));
        useRedis(redis);

        expect(await createApiTrafficStatsCache().get(KEY)).toEqual(value);
    });

    it('returns null on a miss', async () => {
        useRedis(fakeRedis());

        expect(await createApiTrafficStatsCache().get(KEY)).toBeNull();
    });

    it('degrades to a miss and a no-op when Redis is not configured', async () => {
        useRedis(undefined);
        const cache = createApiTrafficStatsCache();

        expect(await cache.get(KEY)).toBeNull();
        await expect(cache.set({ key: KEY, value: 1, ttlSeconds: 3600 })).resolves.toBeUndefined();
    });

    it('returns null and warns when get throws', async () => {
        const redis = fakeRedis();
        redis.get.mockRejectedValue(new Error('boom'));
        useRedis(redis);

        expect(await createApiTrafficStatsCache().get(KEY)).toBeNull();
        expect(apiLogger.warn).toHaveBeenCalled();
    });

    it('swallows and warns when set throws', async () => {
        const redis = fakeRedis();
        redis.setex.mockRejectedValue(new Error('boom'));
        useRedis(redis);

        await expect(
            createApiTrafficStatsCache().set({ key: KEY, value: 1, ttlSeconds: 3600 })
        ).resolves.toBeUndefined();
        expect(apiLogger.warn).toHaveBeenCalled();
    });

    it('treats a corrupted JSON value as a miss and warns', async () => {
        const redis = fakeRedis();
        redis.get.mockResolvedValue('{not json');
        useRedis(redis);

        expect(await createApiTrafficStatsCache().get(KEY)).toBeNull();
        expect(apiLogger.warn).toHaveBeenCalled();
    });

    it('degrades when resolving the client itself throws', async () => {
        vi.mocked(getRedisClient).mockRejectedValue(new Error('no client'));
        const cache = createApiTrafficStatsCache();

        expect(await cache.get(KEY)).toBeNull();
        await expect(cache.set({ key: KEY, value: 1, ttlSeconds: 60 })).resolves.toBeUndefined();
    });
});
