import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    createEffectiveSetCache,
    decodeFiniteOrInfinite,
    encodeFiniteOrInfinite,
    scopeKeyValues,
    subscribeCoverageInvalidation
} from '../../src';
import { FakeRedis } from './fake-redis';

interface TestSnapshot {
    readonly userId: string;
    readonly vertical: string;
    readonly values: readonly (readonly [string, number])[];
}

const codec = {
    encode: (value: TestSnapshot) => JSON.stringify(value),
    decode: (raw: string): TestSnapshot => {
        const value: unknown = JSON.parse(raw);
        if (
            typeof value !== 'object' ||
            value === null ||
            !('userId' in value) ||
            typeof value.userId !== 'string' ||
            !('vertical' in value) ||
            typeof value.vertical !== 'string' ||
            !('values' in value) ||
            !Array.isArray(value.values)
        )
            throw new TypeError('corrupt');
        return value as TestSnapshot;
    }
};

function harness(redis = new FakeRedis()) {
    let instant = new Date('2026-10-08T00:00:00.000Z');
    const warn = vi.fn();
    const create = () =>
        createEffectiveSetCache({
            getClient: async () => redis,
            clock: { now: () => new Date(instant) },
            logger: { warn },
            codec
        });
    return {
        redis,
        create,
        warn,
        advance: (ms: number) => {
            instant = new Date(instant.getTime() + ms);
        }
    };
}

const snapshot = (userId: string, vertical: string, value: number): TestSnapshot => ({
    userId,
    vertical,
    values: [['max_photos_per_accommodation', value]]
});

describe('TEST:V3:8 cache invalidation', () => {
    it.each([
        'user',
        'all'
    ] as const)('rejects an in-flight load written after %s invalidation', async (kind) => {
        const h = harness();
        const cache = h.create();
        let finish!: (value: TestSnapshot) => void;
        const load = vi.fn(
            () =>
                new Promise<TestSnapshot>((resolve) => {
                    finish = resolve;
                })
        );
        const first = cache.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load });
        await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
        if (kind === 'user') await cache.invalidateUser({ userId: 'a' });
        else await cache.invalidateAll();
        finish(snapshot('a', 'ACCOMMODATION', 1));
        await first;
        const fresh = vi.fn(async () => snapshot('a', 'ACCOMMODATION', 2));
        expect(
            (await cache.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load: fresh }))
                .values[0]?.[1]
        ).toBe(2);
        expect(fresh).toHaveBeenCalledOnce();
    });

    it('rejects corrupt and other-version entries and respects computedAt even when hash TTL is refreshed', async () => {
        const h = harness();
        const cache = h.create();
        const key = 'vset:v1:u:a';
        h.redis.hashes.set(key, new Map([['ACCOMMODATION', '{broken']]));
        const load = vi.fn(async () => snapshot('a', 'ACCOMMODATION', 1));
        await cache.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load });
        h.redis.hashes.get(key)?.set('ACCOMMODATION', JSON.stringify({ version: 2 }));
        await cache.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load });
        h.advance(15 * 60 * 1000);
        await cache.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load });
        expect(load).toHaveBeenCalledTimes(3);
    });

    it('rehydrates a test snapshot with scopeKeyValues and refuses another user', async () => {
        const h = harness();
        const cache = h.create();
        await cache.readThrough({
            userId: 'a',
            vertical: 'ACCOMMODATION',
            load: async () => snapshot('a', 'ACCOMMODATION', 4)
        });
        const cached = await cache.readThrough({
            userId: 'a',
            vertical: 'ACCOMMODATION',
            load: async () => {
                throw new Error('unexpected load');
            }
        });
        const scoped = scopeKeyValues({
            userId: cached.userId,
            vertical: cached.vertical,
            values: new Map(cached.values)
        });
        expect(
            scoped.get({
                key: 'max_photos_per_accommodation',
                userId: 'a',
                vertical: 'ACCOMMODATION'
            })
        ).toBe(4);
        expect(
            scoped.get({
                key: 'max_photos_per_accommodation',
                userId: 'b',
                vertical: 'ACCOMMODATION'
            })
        ).toBeUndefined();
    });

    it('uses a shared generation across two containers and all verticals', async () => {
        const h = harness();
        const first = h.create();
        const second = h.create();
        for (const vertical of ['ACCOMMODATION', 'TOURIST', 'GASTRONOMY']) {
            await first.readThrough({
                userId: 'a',
                vertical,
                load: async () => snapshot('a', vertical, 1)
            });
        }
        await first.invalidateUser({ userId: 'a' });
        for (const vertical of ['ACCOMMODATION', 'TOURIST', 'GASTRONOMY']) {
            const load = vi.fn(async () => snapshot('a', vertical, 2));
            expect((await second.readThrough({ userId: 'a', vertical, load })).values[0]?.[1]).toBe(
                2
            );
            expect(load).toHaveBeenCalledOnce();
        }
    });

    it('logs failed invalidation and ignores the suspect entry on next read', async () => {
        const h = harness();
        const cache = h.create();
        await cache.readThrough({
            userId: 'a',
            vertical: 'ACCOMMODATION',
            load: async () => snapshot('a', 'ACCOMMODATION', 1)
        });
        h.redis.failIncr = true;
        await expect(cache.invalidateUser({ userId: 'a' })).resolves.toBeUndefined();
        h.redis.failIncr = false;
        const load = vi.fn(async () => snapshot('a', 'ACCOMMODATION', 2));
        expect(
            (await cache.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load }))
                .values[0]?.[1]
        ).toBe(2);
        expect(load).toHaveBeenCalledOnce();
        expect(h.warn).toHaveBeenCalledWith(expect.any(String), { suspectEntries: 1, userId: 'a' });
    });

    it('loads live on read/write failure and without a client', async () => {
        const h = harness();
        const cache = h.create();
        const load = vi.fn(async () => snapshot('a', 'ACCOMMODATION', 1));
        h.redis.failReads = true;
        await cache.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load });
        h.redis.failReads = false;
        h.redis.failWrites = true;
        await cache.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load });
        const without = createEffectiveSetCache({
            getClient: async () => undefined,
            clock: { now: () => new Date() },
            logger: { warn: h.warn },
            codec
        });
        await without.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load });
        await without.readThrough({ userId: 'a', vertical: 'ACCOMMODATION', load });
        expect(load).toHaveBeenCalledTimes(4);
    });

    it('subscribes to coverage notices by user and can unsubscribe', async () => {
        const billing = new BillingForVerticalsSimulator();
        const invalidateUser = vi.fn(async () => {});
        const unsubscribe = subscribeCoverageInvalidation({ billing, cache: { invalidateUser } });
        const event = {
            userId: 'a',
            vertical: VerticalEnum.ACCOMMODATION,
            sourceType: 'GRANT' as const,
            change: 'REMOVED' as const
        };
        await billing.emitCoverageChanged({ event });
        expect(invalidateUser).toHaveBeenCalledWith({ userId: 'a' });
        unsubscribe();
        await billing.emitCoverageChanged({ event });
        expect(invalidateUser).toHaveBeenCalledTimes(1);
    });
});

describe('Infinity codec', () => {
    it('round-trips positive infinity through JSON and rejects other nonfinite numbers', () => {
        const serialized = JSON.stringify({
            value: encodeFiniteOrInfinite(Number.POSITIVE_INFINITY)
        });
        expect(decodeFiniteOrInfinite(JSON.parse(serialized).value)).toBe(Number.POSITIVE_INFINITY);
        expect(decodeFiniteOrInfinite(encodeFiniteOrInfinite(3))).toBe(3);
        expect(() => decodeFiniteOrInfinite(null)).toThrow();
        expect(() => encodeFiniteOrInfinite(Number.NEGATIVE_INFINITY)).toThrow();
    });
});
