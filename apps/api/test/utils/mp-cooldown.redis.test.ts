import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
});
