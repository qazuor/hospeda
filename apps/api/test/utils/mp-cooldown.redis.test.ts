import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMercadoPagoRedisCoolDownStore } from '../../src/utils/mp-cooldown-redis-store';

const redisUrl = process.env.HOSPEDA_TEST_REDIS_URL;
const client = redisUrl
    ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 0 })
    : undefined;

describe.skipIf(!redisUrl)('Redis shared provider cool-down integration', () => {
    beforeAll(async () => {
        await client?.connect();
        await client?.flushdb();
    });
    afterAll(async () => {
        await client?.flushdb();
        await client?.quit();
    });

    it('shares a 429 deadline across stores and keeps the maximum TTL', async () => {
        const first = createMercadoPagoRedisCoolDownStore({ redisUrl: redisUrl!, client: client! });
        const second = createMercadoPagoRedisCoolDownStore({
            redisUrl: redisUrl!,
            client: client!
        });
        const until = Date.now() + 10_000;
        first.extend({ until });
        await new Promise((resolve) => setTimeout(resolve, 10));
        first.extend({ until: Date.now() + 5_000 });
        await second.refresh?.();
        expect(second.until()).toBeGreaterThan(Date.now());
        const stored = Number(await client!.get('mp:cooldown-until'));
        expect(stored).toBeGreaterThanOrEqual(until);
        expect(await client!.pttl('mp:cooldown-until')).toBeGreaterThan(9_000);
    });

    it('falls back within 50 ms and warns once when its own client cannot connect (kills a swallowed outage)', async () => {
        const warn = vi.fn();
        const store = createMercadoPagoRedisCoolDownStore({
            redisUrl: 'redis://127.0.0.1:1',
            logger: { warn, info: vi.fn() } as never
        });
        // Let the dedicated client fail its first connection and emit `error` before any refresh.
        await new Promise((resolve) => setTimeout(resolve, 300));
        const start = Date.now();
        expect(await store.refresh?.()).toEqual({ fallback: true });
        expect(await store.refresh?.()).toEqual({ fallback: true });
        expect(Date.now() - start).toBeLessThan(50);
        expect(warn).toHaveBeenCalledTimes(1);
    });
});
