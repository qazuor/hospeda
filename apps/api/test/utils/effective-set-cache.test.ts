import { injectClock, systemClock } from '../../src/utils/clock';
import { createApiEffectiveSetCache } from '../../src/utils/effective-set-cache';
import { getRedisClient } from '../../src/utils/redis';

vi.mock('../../src/utils/redis', () => ({ getRedisClient: vi.fn() }));

describe('TEST:V3:13 API effective-set cache without Redis', () => {
    it('reads live twice and never keeps a local fallback entry', async () => {
        injectClock({ clock: systemClock });
        vi.mocked(getRedisClient).mockResolvedValue(undefined);
        const cache = createApiEffectiveSetCache<number>({
            encode: String,
            decode: Number
        });
        const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

        expect(await cache.readThrough({ userId: 'user-1', vertical: 'accommodation', load })).toBe(
            1
        );
        expect(await cache.readThrough({ userId: 'user-1', vertical: 'accommodation', load })).toBe(
            2
        );
        expect(load).toHaveBeenCalledTimes(2);
    });
});
