import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createEffectiveSetCache } from '../../src/effective-set-cache/cache';
import {
    type EffectiveSetSnapshot,
    effectiveSetSnapshotCodec,
    readEffectiveSet,
    rehydrateEffectiveSet
} from '../../src/effective-set-cache/snapshot';
import { subscription } from '../effective-set/sources';
import { createInMemoryCatalog, planVersionRow } from '../plan-catalog/in-memory-catalog-reader';
import { FakeRedis } from './fake-redis';

const vertical = VerticalEnum.ACCOMMODATION;
const other = VerticalEnum.GASTRONOMY;
const snapshot: EffectiveSetSnapshot = {
    version: 1,
    userId: 'A',
    vertical,
    hasLiveNonTrialTitle: true,
    entries: [
        { key: 'priority_support', value: Infinity, strategy: 'MAX' },
        { key: 'max_photos_per_accommodation', value: 12, strategy: 'SUM' }
    ]
};

describe('effective-set snapshot', () => {
    it('round trips Infinity and keeps entitlement and limit scopes separate', () => {
        const decoded = effectiveSetSnapshotCodec.decode(
            effectiveSetSnapshotCodec.encode(snapshot)
        );
        expect(decoded).toEqual(snapshot);
        const scoped = rehydrateEffectiveSet(decoded);
        expect(
            scoped.entitlements.get({ key: 'priority_support', userId: 'A', vertical: null })
        ).toBe(Infinity);
        expect(
            scoped.entitlements.get({ key: 'priority_support', userId: 'B', vertical: null })
        ).toBeUndefined();
        expect(
            scoped.limits.get({ key: 'max_photos_per_accommodation', userId: 'A', vertical })
        ).toBe(12);
        expect(
            scoped.limits.get({ key: 'max_photos_per_accommodation', userId: 'A', vertical: other })
        ).toBeUndefined();
    });

    it('rejects a corrupt value and an obsolete version', () => {
        expect(() => effectiveSetSnapshotCodec.decode('{"version":2}')).toThrow();
        expect(() =>
            effectiveSetSnapshotCodec.decode(
                JSON.stringify({
                    ...snapshot,
                    entries: [{ ...snapshot.entries[0], value: 'broken' }]
                })
            )
        ).toThrow();
    });

    it('treats a corrupt cached value as a miss', async () => {
        const redis = new FakeRedis();
        const cache = createEffectiveSetCache({
            getClient: async () => redis,
            clock: { now: () => new Date('2026-10-09T00:00:00Z') },
            logger: { warn: () => {} },
            codec: effectiveSetSnapshotCodec
        });
        await cache.readThrough({ userId: 'A', vertical, load: async () => snapshot });
        const hash = redis.hashes.get('vset:v1:u:A')!;
        const envelope = JSON.parse(hash.get(vertical)!) as { value: string };
        hash.set(vertical, JSON.stringify({ ...envelope, value: '{"version":2}' }));
        let loads = 0;
        await cache.readThrough({
            userId: 'A',
            vertical,
            load: async () => {
                loads += 1;
                return snapshot;
            }
        });
        expect(loads).toBe(1);
    });

    it('resolves live when Redis contains a snapshot for another vertical', async () => {
        const redis = new FakeRedis();
        const cache = createEffectiveSetCache({
            getClient: async () => redis,
            clock: { now: () => new Date('2026-10-09T00:00:00Z') },
            logger: { warn: () => {} },
            codec: effectiveSetSnapshotCodec
        });
        const catalog = createInMemoryCatalog();
        const id = catalog.addPlanVersion(
            planVersionRow({
                entitlements: [
                    {
                        key: 'priority_support',
                        planQuota: null,
                        trialQuota: null,
                        aggregationStrategy: 'MAX'
                    }
                ]
            })
        );
        const source = {
            ...subscription([]).source,
            reference: { kind: 'PLAN_VERSION' as const, planVersionId: id }
        };
        const args = {
            cache,
            reader: catalog.reader,
            billing: { coverage: async () => ({ covered: true, sources: [source] }) },
            trials: { findTrial: async () => null },
            userId: 'A',
            vertical
        };
        await readEffectiveSet(args);
        const hash = redis.hashes.get('vset:v1:u:A')!;
        const envelope = JSON.parse(hash.get(vertical)!) as { value: string };
        hash.set(
            vertical,
            JSON.stringify({
                ...envelope,
                value: effectiveSetSnapshotCodec.encode({
                    ...snapshot,
                    vertical: other,
                    entries: []
                })
            })
        );
        const result = await readEffectiveSet(args);
        expect(
            result.entitlements.get({ key: 'priority_support', userId: 'A', vertical: null })
        ).toBe(Infinity);
        expect(result.vertical).toBe(vertical);
    });
});
