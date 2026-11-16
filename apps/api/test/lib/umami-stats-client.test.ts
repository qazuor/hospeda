/**
 * @file umami-stats-client.test.ts
 * @description Unit tests for the Umami stats adapter (HOS-2119, T-046). Fetch is mocked.
 */

import { EntityTypeEnum } from '@repo/schemas';
import type { TrafficStatsScope } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createUmamiStatsClient,
    UMAMI_STATS_TIMEOUT_MS,
    UmamiStatsError
} from '../../src/lib/umami-stats-client';
import { apiLogger } from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const WEBSITE = '07b2a9cf-a599-4632-8fae-09ba4988a2e3';
const KEY = 'umami_testkey';
const ENTITY_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const ENTITY_B = 'bbbbbbbb-2222-4222-8222-222222222222';

const scopeFor = (entityId: string): TrafficStatsScope => ({
    entityType: EntityTypeEnum.ACCOMMODATION,
    entityId,
    window: '7d',
    startAt: 1000,
    endAt: 2000,
    timeZone: 'America/Argentina/Buenos_Aires'
});

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Fetch mock routing by path; records every call. */
function makeFetch(routes: Record<string, unknown>) {
    return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
        const u = new URL(String(url));
        const name = u.pathname.split('/').pop() ?? '';
        return json(routes[name] ?? {});
    });
}

const make = (fetchImpl: typeof fetch) =>
    createUmamiStatsClient({
        baseUrl: 'https://umami.test/',
        websiteId: WEBSITE,
        apiKey: KEY,
        fetchImpl
    });

const calls = (f: ReturnType<typeof makeFetch>) => f.mock.calls.map(([u]) => new URL(String(u)));

describe('createUmamiStatsClient', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    describe('getBreakdown', () => {
        it('should request metrics with tag, range, timezone and bearer auth', async () => {
            const f = makeFetch({ metrics: [{ x: 'google.com', y: 4 }] });
            const rows = await make(f as unknown as typeof fetch).getBreakdown({
                ...scopeFor(ENTITY_A),
                dimension: 'referrer'
            });

            expect(rows).toEqual([{ value: 'google.com', count: 4 }]);
            const [u] = calls(f);
            if (!u) throw new Error('no call');
            expect(u.origin + u.pathname).toBe(
                `https://umami.test/api/websites/${WEBSITE}/metrics`
            );
            expect(Object.fromEntries(u.searchParams)).toEqual({
                type: 'referrer',
                tag: ENTITY_A,
                startAt: '1000',
                endAt: '2000',
                timezone: 'America/Argentina/Buenos_Aires'
            });
            const init = f.mock.calls[0]?.[1];
            expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
        });

        it.each([
            'referrer',
            'country',
            'device'
        ] as const)('should carry the entity tag for %s', async (dimension) => {
            const f = makeFetch({ metrics: [] });
            await make(f as unknown as typeof fetch).getBreakdown({
                ...scopeFor(ENTITY_B),
                dimension
            });
            expect(calls(f)[0]?.searchParams.get('type')).toBe(dimension);
            expect(calls(f)[0]?.searchParams.get('tag')).toBe(ENTITY_B);
        });

        it('should drop null and empty x rows (direct traffic)', async () => {
            const f = makeFetch({
                metrics: [
                    { x: null, y: 3 },
                    { x: '', y: 2 },
                    { x: '  ', y: 1 },
                    { x: 'ar', y: 5 }
                ]
            });
            const rows = await make(f as unknown as typeof fetch).getBreakdown({
                ...scopeFor(ENTITY_A),
                dimension: 'country'
            });
            expect(rows).toEqual([{ value: 'ar', count: 5 }]);
        });
    });

    describe('getVisitorCount', () => {
        it('should return stats visitors with ONE entity-filtered stats call and no contact events', async () => {
            const f = makeFetch({ stats: { pageviews: 9, visitors: 3 } });
            const result = await make(f as unknown as typeof fetch).getVisitorCount(
                scopeFor(ENTITY_A)
            );

            expect(result).toBe(3);
            const urls = calls(f);
            expect(urls).toHaveLength(1);
            expect(urls[0]?.pathname.endsWith('/stats')).toBe(true);
            expect(urls[0]?.searchParams.get('tag')).toBe(ENTITY_A);
        });

        it('should reject an invalid entity id before any fetch', async () => {
            const f = makeFetch({ stats: { pageviews: 0, visitors: 0 } });
            await expect(
                make(f as unknown as typeof fetch).getVisitorCount(scopeFor('nope'))
            ).rejects.toMatchObject({ kind: 'schema' });
            expect(f).not.toHaveBeenCalled();
        });
    });

    describe('getFunnelCounts', () => {
        it('should map stats pageviews and pivot counts, filtering EVERY request by entity', async () => {
            const f = vi.fn(async (url: string | URL | Request) => {
                const u = new URL(String(url));
                const path = u.pathname.split('/').pop();
                if (path === 'stats') return json({ pageviews: 9, visitors: 3 });
                return json({
                    count: u.searchParams.get('eventName') === 'contact_owner_started' ? 4 : 2,
                    data: []
                });
            });
            const result = await make(f as unknown as typeof fetch).getFunnelCounts(
                scopeFor(ENTITY_A)
            );

            expect(result).toEqual({
                views: 9,
                visitors: 3,
                contactStarted: 4,
                contactCompleted: 2
            });
            const urls = f.mock.calls.map(([u]) => new URL(String(u)));
            expect(urls).toHaveLength(3);
            for (const u of urls) {
                expect(u.pathname).not.toContain('/values');
                const filtered =
                    u.searchParams.get('tag') === ENTITY_A ||
                    u.searchParams.get('pf_entity_id') === `eq.${ENTITY_A}`;
                expect(filtered).toBe(true);
                expect(u.searchParams.get('startAt')).toBe('1000');
                expect(u.searchParams.get('endAt')).toBe('2000');
            }
            const pivots = urls.filter((u) => u.pathname.endsWith('/event-data-pivot'));
            expect(pivots.map((u) => u.searchParams.get('eventName')).sort()).toEqual([
                'contact_owner_completed',
                'contact_owner_started'
            ]);
        });

        it('should reject when the stats response has no visitors', async () => {
            const f = makeFetch({ stats: { pageviews: 1 }, 'event-data-pivot': { count: 0 } });
            await expect(
                make(f as unknown as typeof fetch).getFunnelCounts(scopeFor(ENTITY_A))
            ).rejects.toMatchObject({ kind: 'schema' });
        });

        it('should warn when the pivot count is capped but still return it', async () => {
            vi.mocked(apiLogger.warn).mockClear();
            const f = makeFetch({
                stats: { pageviews: 1, visitors: 1 },
                'event-data-pivot': { count: 7, isCapped: true }
            });
            const result = await make(f as unknown as typeof fetch).getFunnelCounts(
                scopeFor(ENTITY_A)
            );
            expect(result.contactStarted).toBe(7);
            expect(apiLogger.warn).toHaveBeenCalled();
            expect(JSON.stringify(vi.mocked(apiLogger.warn).mock.calls)).not.toContain(KEY);
        });

        it('should never mix entities: two entities produce disjoint filters', async () => {
            const f = makeFetch({
                stats: { pageviews: 0, visitors: 0 },
                'event-data-pivot': { count: 0 },
                metrics: []
            });
            const client = make(f as unknown as typeof fetch);
            await client.getFunnelCounts(scopeFor(ENTITY_A));
            await client.getFunnelCounts(scopeFor(ENTITY_B));
            await client.getBreakdown({ ...scopeFor(ENTITY_B), dimension: 'device' });

            const all = calls(f);
            expect(all).toHaveLength(7);
            for (const u of all) {
                const entity = u.searchParams.get('tag') ?? u.searchParams.get('pf_entity_id');
                expect(entity).not.toBeNull();
                // Each request references exactly one entity id.
                const raw = u.search;
                expect(raw.includes(ENTITY_A) && raw.includes(ENTITY_B)).toBe(false);
            }
            expect(all.filter((u) => u.search.includes(ENTITY_A))).toHaveLength(3);
            expect(all.filter((u) => u.search.includes(ENTITY_B))).toHaveLength(4);
        });
    });

    describe('errors', () => {
        it('should throw an http UmamiStatsError on non-2xx', async () => {
            const f = vi.fn(async () => json({ error: 'x' }, 401));
            const p = make(f as unknown as typeof fetch).getBreakdown({
                ...scopeFor(ENTITY_A),
                dimension: 'referrer'
            });
            await expect(p).rejects.toMatchObject({
                name: 'UmamiStatsError',
                kind: 'http',
                status: 401
            });
        });

        it('should throw a schema error on shape mismatch', async () => {
            const f = makeFetch({ metrics: { nope: true } });
            await expect(
                make(f as unknown as typeof fetch).getBreakdown({
                    ...scopeFor(ENTITY_A),
                    dimension: 'referrer'
                })
            ).rejects.toMatchObject({ kind: 'schema' });
        });

        it('should throw a schema error on malformed JSON', async () => {
            const f = vi.fn(async () => new Response('<html>', { status: 200 }));
            await expect(
                make(f as unknown as typeof fetch).getFunnelCounts(scopeFor(ENTITY_A))
            ).rejects.toMatchObject({ name: 'UmamiStatsError', kind: 'schema' });
        });

        it('should throw a timeout (not schema) when the abort fires while reading the body', async () => {
            const f = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const res = {
                    ok: true,
                    status: 200,
                    json: () =>
                        new Promise<unknown>((_resolve, reject) => {
                            init?.signal?.addEventListener('abort', () =>
                                reject(new DOMException('aborted', 'AbortError'))
                            );
                        })
                };
                return res as unknown as Response;
            });
            const p = make(f as unknown as typeof fetch).getBreakdown({
                ...scopeFor(ENTITY_A),
                dimension: 'referrer'
            });
            const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' });
            await vi.advanceTimersByTimeAsync(UMAMI_STATS_TIMEOUT_MS);
            await assertion;
            expect(vi.getTimerCount()).toBe(0);
        });

        it('should throw a network error when fetch rejects', async () => {
            const f = vi.fn(async () => {
                throw new TypeError('fetch failed');
            });
            await expect(
                make(f as unknown as typeof fetch).getBreakdown({
                    ...scopeFor(ENTITY_A),
                    dimension: 'device'
                })
            ).rejects.toMatchObject({ kind: 'network' });
        });

        it('should abort and throw a timeout error after 3 s', async () => {
            const f = vi.fn(
                (_url: string | URL | Request, init?: RequestInit) =>
                    new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () =>
                            reject(new DOMException('aborted', 'AbortError'))
                        );
                    })
            );
            const p = make(f as unknown as typeof fetch).getBreakdown({
                ...scopeFor(ENTITY_A),
                dimension: 'referrer'
            });
            const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' });
            await vi.advanceTimersByTimeAsync(UMAMI_STATS_TIMEOUT_MS - 1);
            expect(f.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
            await vi.advanceTimersByTimeAsync(1);
            await assertion;
            expect(UMAMI_STATS_TIMEOUT_MS).toBe(3000);
        });

        it('should not leak the API key in error messages or called URLs', async () => {
            const timeoutFetch = vi.fn(
                (_url: string | URL | Request, init?: RequestInit) =>
                    new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () =>
                            reject(new DOMException('aborted', 'AbortError'))
                        );
                    })
            );
            const cases: ReadonlyArray<ReturnType<typeof vi.fn>> = [
                vi.fn(async () => json({}, 500)),
                vi.fn(async () => {
                    throw new TypeError(`fetch failed ${KEY}`);
                }),
                timeoutFetch
            ];
            for (const f of cases) {
                const pending = make(f as unknown as typeof fetch)
                    .getFunnelCounts(scopeFor(ENTITY_A))
                    .catch((e: unknown) => e);
                await vi.advanceTimersByTimeAsync(UMAMI_STATS_TIMEOUT_MS);
                const err = await pending;
                expect(err).toBeInstanceOf(UmamiStatsError);
                expect((err as Error).message).not.toContain(KEY);
                for (const [url] of f.mock.calls) {
                    expect(String(url)).not.toContain(KEY);
                }
            }
        });

        it.each([
            '',
            'not-a-uuid',
            "x' OR 1=1 --",
            '../../etc/passwd'
        ])('should reject invalid entity id %j before any fetch', async (bad) => {
            const f = makeFetch({
                stats: { pageviews: 0, visitors: 0 },
                'event-data-pivot': { count: 0 }
            });
            const client = make(f as unknown as typeof fetch);
            await expect(client.getFunnelCounts(scopeFor(bad))).rejects.toMatchObject({
                kind: 'schema'
            });
            await expect(
                client.getBreakdown({ ...scopeFor(bad), dimension: 'referrer' })
            ).rejects.toMatchObject({ kind: 'schema' });
            expect(f).not.toHaveBeenCalled();
        });

        it('should leave no pending timers after a successful or failed request', async () => {
            const ok = makeFetch({ metrics: [] });
            await make(ok as unknown as typeof fetch).getBreakdown({
                ...scopeFor(ENTITY_A),
                dimension: 'referrer'
            });
            expect(vi.getTimerCount()).toBe(0);

            const bad = vi.fn(async () => json({}, 500));
            await make(bad as unknown as typeof fetch)
                .getBreakdown({ ...scopeFor(ENTITY_A), dimension: 'referrer' })
                .catch(() => undefined);
            expect(vi.getTimerCount()).toBe(0);
        });
    });
});
