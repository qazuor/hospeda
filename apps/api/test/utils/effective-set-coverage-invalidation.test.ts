import { VerticalEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRedis } from '../../../../packages/verticals/test/effective-set-cache/fake-redis';
import { injectClock, systemClock } from '../../src/utils/clock';
import { createApiEffectiveSetCache } from '../../src/utils/effective-set-cache';
import { subscribeEffectiveSetCoverageInvalidation } from '../../src/utils/effective-set-coverage-invalidation';
import { getCoverageNotices } from '../../src/utils/listing-access/coverage-notices';
import { getRedisClient } from '../../src/utils/redis';

vi.mock('../../src/utils/redis', () => ({ getRedisClient: vi.fn() }));

type RedisClient = Awaited<ReturnType<typeof getRedisClient>>;

describe('TEST:1738:2 AC:1738:2 API effective-set cache invalidation on coverage notices', () => {
    let stop: (() => void) | undefined;

    beforeEach(() => {
        injectClock({ clock: systemClock });
        vi.mocked(getRedisClient).mockResolvedValue(new FakeRedis() as unknown as RedisClient);
        stop = subscribeEffectiveSetCoverageInvalidation();
    });

    afterEach(() => {
        stop?.();
        stop = undefined;
    });

    it('re-reads the effective set after a tourist ADDED notice', async () => {
        const userId = 'user-1';
        const cache = createApiEffectiveSetCache<number>({ encode: String, decode: Number });
        const load = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);

        expect(await cache.readThrough({ userId, vertical: VerticalEnum.TOURIST, load })).toBe(0);
        await getCoverageNotices().emitCoverageChanged({
            userId,
            vertical: VerticalEnum.TOURIST,
            sourceType: 'SUBSCRIPTION',
            change: 'ADDED'
        });
        expect(await cache.readThrough({ userId, vertical: VerticalEnum.TOURIST, load })).toBe(1);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('re-reads the effective set after an accommodation REMOVED notice', async () => {
        const userId = 'user-2';
        const cache = createApiEffectiveSetCache<number>({ encode: String, decode: Number });
        const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);

        expect(
            await cache.readThrough({ userId, vertical: VerticalEnum.ACCOMMODATION, load })
        ).toBe(1);
        await getCoverageNotices().emitCoverageChanged({
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
        expect(
            await cache.readThrough({ userId, vertical: VerticalEnum.ACCOMMODATION, load })
        ).toBe(0);
        expect(load).toHaveBeenCalledTimes(2);
    });
});
