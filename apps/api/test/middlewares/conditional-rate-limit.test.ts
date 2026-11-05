import { beforeEach, describe, expect, it } from 'vitest';
import {
    clearSlidingWindowStore,
    createConditionalSlidingWindowConsumer
} from '../../src/middlewares/rate-limit';

describe('conditional sliding-window consumer', () => {
    beforeEach(() => clearSlidingWindowStore());

    it('allows exactly five consumes per identity and reports the rolling count', async () => {
        const limiter = createConditionalSlidingWindowConsumer({
            keyPrefix: 'test-new-user-import',
            windowMs: 24 * 60 * 60 * 1000,
            max: 5
        });
        for (let i = 0; i < 5; i += 1) {
            await expect(limiter.consume('user-1')).resolves.toBe(true);
        }
        await expect(limiter.count('user-1')).resolves.toBe(5);
        await expect(limiter.consume('user-1')).resolves.toBe(false);
        await expect(limiter.count('user-2')).resolves.toBe(0);
    });

    it('never allows concurrent consumes to exceed the configured maximum', async () => {
        const limiter = createConditionalSlidingWindowConsumer({
            keyPrefix: 'test-concurrent-new-user-import',
            windowMs: 24 * 60 * 60 * 1000,
            max: 5
        });
        const results = await Promise.all(
            Array.from({ length: 20 }, () => limiter.consume('user-concurrent'))
        );
        expect(results.filter(Boolean)).toHaveLength(5);
        await expect(limiter.count('user-concurrent')).resolves.toBe(5);
    });
});
