import { EntityTypeEnum, ListingTrafficStatsResponseSchema } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
    FunnelCounts,
    GetBreakdownInput,
    TrafficStatsCachePort,
    TrafficStatsClientPort,
    TrafficStatsScope
} from '../../../src/services/listing-traffic-stats/index.js';
import {
    buildListingTrafficStatsCacheKey,
    ListingTrafficStatsService
} from '../../../src/services/listing-traffic-stats/index.js';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_HEX = 'abcdef12-abcd-4abc-8abc-abcdefabcdef';
const ID_B = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-11-15T10:00:00.000Z');

const emptyFunnel: FunnelCounts = { views: 0, contactStarted: 0, contactCompleted: 0 };

const ISO = (iso: string): number => new Date(iso).getTime();

function makeClient(overrides: Partial<TrafficStatsClientPort> = {}) {
    const getBreakdown = vi.fn(async (input: GetBreakdownInput) => [
        { value: `${input.dimension}-${input.entityId}`, count: 3 }
    ]);
    const getFunnelCounts = vi.fn(async (_scope: TrafficStatsScope) => emptyFunnel);
    const client: TrafficStatsClientPort = { getBreakdown, getFunnelCounts, ...overrides };
    return { client, getBreakdown, getFunnelCounts };
}

function makeCache(initial: Record<string, unknown> = {}) {
    const store = new Map<string, unknown>(Object.entries(initial));
    const get = vi.fn(async (key: string) => store.get(key) ?? null);
    const set = vi.fn(async (input: { key: string; value: unknown; ttlSeconds: number }) => {
        store.set(input.key, input.value);
    });
    const cache: TrafficStatsCachePort = { get, set };
    return { cache, get, set, store };
}

function make(
    opts: { client?: TrafficStatsClientPort; cache?: TrafficStatsCachePort; now?: Date } = {}
) {
    const c = makeClient();
    const k = makeCache();
    const service = new ListingTrafficStatsService({
        statsClient: opts.client ?? c.client,
        cache: opts.cache ?? k.cache,
        now: () => opts.now ?? NOW,
        timeoutMs: 50
    });
    return { service, ...c, ...k };
}

describe('ListingTrafficStatsService', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('cache', () => {
        it('should skip the port when the cache has a valid entry', async () => {
            const hit = {
                window: '7d',
                available: true,
                referrers: [{ value: 'cached.com', count: 1 }],
                countries: [],
                devices: [],
                contactFunnel: null
            };
            const key = buildListingTrafficStatsCacheKey({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '7d'
            });
            const c = makeClient();
            const k = makeCache({ [key]: hit });
            const { service } = make({ client: c.client, cache: k.cache });

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '7d'
            });

            expect(result).toEqual(hit);
            expect(k.set).not.toHaveBeenCalled();
            expect(c.getBreakdown).not.toHaveBeenCalled();
            expect(c.getFunnelCounts).not.toHaveBeenCalled();
        });

        it('should call the port on a miss and store with a 3600s TTL', async () => {
            const { service, getBreakdown, set } = make();

            await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '7d'
            });

            expect(getBreakdown).toHaveBeenCalledTimes(3);
            expect(set).toHaveBeenCalledTimes(1);
            const arg = set.mock.calls[0]?.[0];
            expect(arg?.key).toBe(`traffic-stats:VENUE:${ID_A}:7d`);
            expect(arg?.ttlSeconds).toBe(3600);
        });

        it('should store exactly the value it returns on a miss', async () => {
            const { service, set } = make();

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '7d'
            });

            expect(set.mock.calls[0]?.[0].value).toEqual(result);
        });

        it('should treat a cached available:false entry as a miss', async () => {
            const key = buildListingTrafficStatsCacheKey({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '7d'
            });
            const c = makeClient();
            const k = makeCache({
                [key]: {
                    window: '7d',
                    available: false,
                    referrers: [],
                    countries: [],
                    devices: [],
                    contactFunnel: null
                }
            });
            const { service } = make({ client: c.client, cache: k.cache });

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '7d'
            });

            expect(c.getBreakdown).toHaveBeenCalledTimes(3);
            expect(result.available).toBe(true);
        });

        it('should treat a cache read that never resolves as a miss within the budget', async () => {
            vi.useFakeTimers();
            const k = makeCache();
            const cache: TrafficStatsCachePort = {
                get: vi.fn(() => new Promise<never>(() => undefined)),
                set: k.set
            };
            const c = makeClient();
            const { service } = make({ client: c.client, cache });

            const pending = service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A
            });
            await vi.advanceTimersByTimeAsync(200);

            expect(c.getBreakdown).toHaveBeenCalledTimes(3);
            const result = await pending;
            expect(result.available).toBe(true);
        });

        it('should treat an invalid cached value as a miss', async () => {
            const key = buildListingTrafficStatsCacheKey({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '30d'
            });
            const c = makeClient();
            const k = makeCache({ [key]: { garbage: true } });
            const { service } = make({ client: c.client, cache: k.cache });

            await service.getStats({ entityType: EntityTypeEnum.VENUE, entityId: ID_A });

            expect(c.getBreakdown).toHaveBeenCalledTimes(3);
        });

        it('should still answer when the cache itself fails', async () => {
            const get = vi.fn(async () => {
                throw new Error('redis down');
            });
            const set = vi.fn(async () => {
                throw new Error('redis down');
            });
            const cache: TrafficStatsCachePort = { get, set };
            const c = makeClient();
            const { service } = make({ cache, client: c.client });

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A
            });

            expect(result.available).toBe(true);
            expect(get).toHaveBeenCalledTimes(1);
            expect(c.getBreakdown).toHaveBeenCalledTimes(3);
            expect(set).toHaveBeenCalledTimes(1);
        });
    });

    describe('Umami failure', () => {
        it('should answer available:false with empty arrays and NOT cache when the port rejects', async () => {
            const c = makeClient({
                getBreakdown: vi.fn(async () => {
                    throw new Error('umami 500');
                })
            });
            const { service, set } = make({ client: c.client });

            const result = await service.getStats({
                entityType: EntityTypeEnum.ACCOMMODATION,
                entityId: ID_A,
                window: '7d'
            });

            expect(result).toEqual({
                window: '7d',
                available: false,
                referrers: [],
                countries: [],
                devices: [],
                contactFunnel: null
            });
            expect(ListingTrafficStatsResponseSchema.safeParse(result).success).toBe(true);
            expect(set).not.toHaveBeenCalled();
        });

        it('should answer available:false and NOT cache when the port times out', async () => {
            const c = makeClient({
                getBreakdown: vi.fn(() => new Promise<never>(() => undefined))
            });
            const { service, set } = make({ client: c.client });

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A
            });

            expect(result.available).toBe(false);
            expect(set).not.toHaveBeenCalled();
        });

        it('should not surface an unhandled rejection when the port rejects after the timeout', async () => {
            const c = makeClient({
                getBreakdown: vi.fn(
                    () =>
                        new Promise<never>((_resolve, reject) => {
                            setTimeout(() => reject(new Error('late umami failure')), 90);
                        })
                )
            });
            const { service, set } = make({ client: c.client });

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A
            });
            await new Promise((resolve) => setTimeout(resolve, 150));

            expect(result.available).toBe(false);
            expect(set).not.toHaveBeenCalled();
        });

        it('should not cache when only the funnel call fails', async () => {
            const c = makeClient({
                getFunnelCounts: vi.fn(async () => {
                    throw new Error('boom');
                })
            });
            const { service, set } = make({ client: c.client });

            const result = await service.getStats({
                entityType: EntityTypeEnum.ACCOMMODATION,
                entityId: ID_A
            });

            expect(result.available).toBe(false);
            expect(set).not.toHaveBeenCalled();
        });
    });

    describe('assembly', () => {
        it('should cap referrers to the top 5 by count', async () => {
            const c = makeClient({
                getBreakdown: vi.fn(async (input: GetBreakdownInput) =>
                    input.dimension === 'referrer'
                        ? Array.from({ length: 8 }, (_, i) => ({ value: `r${i}`, count: i + 1 }))
                        : []
                )
            });
            const { service } = make({ client: c.client });

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A
            });

            expect(result.referrers.map((r) => r.value)).toEqual(['r7', 'r6', 'r5', 'r4', 'r3']);
            expect(ListingTrafficStatsResponseSchema.safeParse(result).success).toBe(true);
        });

        it('should map the funnel totals into contactFunnel', async () => {
            const funnelSpy = vi.fn(
                async (_scope: TrafficStatsScope): Promise<FunnelCounts> => ({
                    views: 15,
                    contactStarted: 3,
                    contactCompleted: 1
                })
            );
            const c = makeClient({ getFunnelCounts: funnelSpy });
            const { service } = make({ client: c.client });

            const result = await service.getStats({
                entityType: EntityTypeEnum.ACCOMMODATION,
                entityId: ID_A,
                window: '7d'
            });

            expect(result.contactFunnel).toEqual({
                views: 15,
                contactStarted: 3,
                contactCompleted: 1
            });
            expect(ListingTrafficStatsResponseSchema.safeParse(result).success).toBe(true);
        });

        it('should sort countries and devices by count descending without capping them', async () => {
            const rows = Array.from({ length: 8 }, (_, i) => ({ value: `v${i}`, count: i }));
            const c = makeClient({
                getBreakdown: vi.fn(async (input: GetBreakdownInput) =>
                    input.dimension === 'referrer' ? [] : rows
                )
            });
            const { service } = make({ client: c.client });

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A
            });

            const expected = ['v7', 'v6', 'v5', 'v4', 'v3', 'v2', 'v1', 'v0'];
            expect(result.countries.map((r) => r.value)).toEqual(expected);
            expect(result.devices.map((r) => r.value)).toEqual(expected);
        });

        it('should drop invalid breakdown rows individually and keep the rest and the funnel', async () => {
            const warn = vi.fn();
            const bad = [
                { value: null, count: 1 },
                { value: '', count: 1 },
                { value: 'x', count: 1.5 },
                { value: 'y', count: -1 }
            ] as unknown as { value: string; count: number }[];
            const c = makeClient({
                getBreakdown: vi.fn(async (input: GetBreakdownInput) =>
                    input.dimension === 'country' ? [{ value: 'AR', count: 4 }, ...bad] : []
                ),
                getFunnelCounts: vi.fn(async () => ({
                    views: 2,
                    contactStarted: 1,
                    contactCompleted: 0
                }))
            });
            const k = makeCache();
            const service = new ListingTrafficStatsService({
                statsClient: c.client,
                cache: k.cache,
                logger: { warn } as never,
                now: () => NOW,
                timeoutMs: 50
            });

            const result = await service.getStats({
                entityType: EntityTypeEnum.ACCOMMODATION,
                entityId: ID_A
            });

            expect(result.available).toBe(true);
            expect(result.countries).toEqual([{ value: 'AR', count: 4 }]);
            expect(result.contactFunnel).toEqual({
                views: 2,
                contactStarted: 1,
                contactCompleted: 0
            });
            expect(warn).toHaveBeenCalledTimes(1);
        });

        it.each([
            EntityTypeEnum.VENUE,
            EntityTypeEnum.EXPERIENCE,
            EntityTypeEnum.PARTNER
        ] as const)('should return contactFunnel null and not call the funnel port for %s', async (entityType) => {
            const { service, getFunnelCounts } = make();

            const result = await service.getStats({ entityType, entityId: ID_A });

            expect(result.contactFunnel).toBeNull();
            expect(getFunnelCounts).not.toHaveBeenCalled();
            expect(ListingTrafficStatsResponseSchema.safeParse(result).success).toBe(true);
        });

        it('should reject an invalid entity id before any query goes out', async () => {
            const { service, getBreakdown } = make();

            await expect(
                service.getStats({ entityType: EntityTypeEnum.VENUE, entityId: '' })
            ).rejects.toThrow();
            expect(getBreakdown).not.toHaveBeenCalled();
        });
    });

    describe('window and scope', () => {
        const expectedWindows = {
            '7d': ISO('2026-11-09T03:00:00.000Z'),
            '30d': ISO('2026-10-17T03:00:00.000Z'),
            '90d': ISO('2026-08-18T03:00:00.000Z')
        } as const;

        it.each([
            '7d',
            '30d',
            '90d'
        ] as const)('should build the exact scope for %s', async (window) => {
            const { service, getBreakdown } = make();

            await service.getStats({ entityType: EntityTypeEnum.VENUE, entityId: ID_A, window });

            expect(getBreakdown.mock.calls[0]?.[0]).toEqual({
                entityType: 'VENUE',
                entityId: ID_A,
                window,
                startAt: expectedWindows[window],
                endAt: NOW.getTime(),
                timeZone: 'America/Argentina/Buenos_Aires',
                dimension: 'referrer'
            });
        });

        it('should default to the 30d window', async () => {
            const { service, getBreakdown } = make();

            const result = await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A
            });

            expect(result.window).toBe('30d');
            expect(getBreakdown.mock.calls[0]?.[0].startAt).toBe(expectedWindows['30d']);
        });

        it('should flip the window at LOCAL midnight (03:00Z), not at UTC midnight', async () => {
            const before = make({ now: new Date('2026-11-15T02:59:59.999Z') });
            const after = make({ now: new Date('2026-11-15T03:00:00.000Z') });

            await before.service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '7d'
            });
            await after.service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_A,
                window: '7d'
            });

            expect(before.getBreakdown.mock.calls[0]?.[0].startAt).toBe(
                ISO('2026-11-08T03:00:00.000Z')
            );
            expect(after.getBreakdown.mock.calls[0]?.[0].startAt).toBe(
                ISO('2026-11-09T03:00:00.000Z')
            );
        });

        it('should lower-case the entity id for the port scope and the cache key', async () => {
            const { service, getBreakdown, get, set } = make();

            await service.getStats({
                entityType: EntityTypeEnum.VENUE,
                entityId: ID_HEX.toUpperCase(),
                window: '7d'
            });

            expect(getBreakdown.mock.calls[0]?.[0].entityId).toBe(ID_HEX);
            expect(get).toHaveBeenCalledWith(`traffic-stats:VENUE:${ID_HEX}:7d`);
            expect(set.mock.calls[0]?.[0].key).toBe(`traffic-stats:VENUE:${ID_HEX}:7d`);
        });
    });

    describe('entity isolation (contract)', () => {
        it('should carry the exact entity scope on every port call and never leak between entities', async () => {
            const { service, getBreakdown, getFunnelCounts, store } = make();
            const scopeFor = (entityId: string) => ({
                entityType: 'ACCOMMODATION',
                entityId,
                window: '30d',
                startAt: ISO('2026-10-17T03:00:00.000Z'),
                endAt: NOW.getTime(),
                timeZone: 'America/Argentina/Buenos_Aires'
            });

            const a = await service.getStats({
                entityType: EntityTypeEnum.ACCOMMODATION,
                entityId: ID_A
            });
            const callsA = getBreakdown.mock.calls.map((c) => c[0]);
            const funnelA = getFunnelCounts.mock.calls.map((c) => c[0]);
            getBreakdown.mockClear();
            getFunnelCounts.mockClear();
            const b = await service.getStats({
                entityType: EntityTypeEnum.ACCOMMODATION,
                entityId: ID_B
            });
            const callsB = getBreakdown.mock.calls.map((c) => c[0]);
            const funnelB = getFunnelCounts.mock.calls.map((c) => c[0]);

            expect(callsA).toHaveLength(3);
            expect(callsB).toHaveLength(3);
            for (const call of callsA) {
                expect(call).toEqual({ ...scopeFor(ID_A), dimension: call.dimension });
            }
            for (const call of callsB) {
                expect(call).toEqual({ ...scopeFor(ID_B), dimension: call.dimension });
            }
            expect(funnelA).toEqual([scopeFor(ID_A)]);
            expect(funnelB).toEqual([scopeFor(ID_B)]);
            expect(a.referrers[0]?.value).toBe(`referrer-${ID_A}`);
            expect(b.referrers[0]?.value).toBe(`referrer-${ID_B}`);
            expect(store.size).toBe(2);
        });
    });
});
