/**
 * Integration tests for
 * GET /api/v1/protected/views/:entityType/:entityId/traffic-stats
 * (HOS-2119, T-048, AC-7, AC-8).
 *
 * The whole app is booted with `initApp()`; only the boundaries are replaced:
 *  - the ownership readers (`findIdsByOwnerId` of the three `@repo/db` model
 *    singletons),
 *  - the effective-set port behind `enforceUserGate`,
 *  - the Redis client behind the traffic stats cache,
 *  - the global `fetch`, which is what the real `UmamiStatsClient` calls.
 *
 * Status matrix covered: 200 (own listing, three types), 401, 403 (gate and
 * accommodation permission), 400 (type, id, window), 404 (foreign, missing,
 * identical bodies), 200 `available:false` (Umami 5xx, Umami hang, env unset).
 *
 * @module test/routes/views/protected/traffic-stats
 * @see HOS-2119 T-048
 */

import { PermissionEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockAccommodationIds, mockVenueIds, mockExperienceIds, gateState } = vi.hoisted(() => ({
    mockAccommodationIds: vi.fn(),
    mockVenueIds: vi.fn(),
    mockExperienceIds: vi.fn(),
    gateState: { grantViewBasicStats: true }
}));

// `test/setup.ts` replaces `@repo/service-core` (including `ServiceError`) with fakes,
// under which the real error formatter answers 500 for every typed error. Restore the
// real package for this file only, as `existence-disclosure.paired-probe.test.ts` does.
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../../helpers/mocks/db-mock');
    const base = createDbMock();
    return {
        ...base,
        accommodationModel: { ...base.accommodationModel, findIdsByOwnerId: mockAccommodationIds },
        venueModel: { findIdsByOwnerId: mockVenueIds },
        experienceModel: { findIdsByOwnerId: mockExperienceIds }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: gateState.grantViewBasicStats
                    ? [{ key: 'view_basic_stats', value: 1, strategy: 'MAX' }]
                    : []
            })
    })
}));

vi.mock('../../../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(null)
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { initApp } from '../../../../src/app';
import { _resetTrafficStatsServiceForTests } from '../../../../src/routes/views/protected/traffic-stats';
import type { AppOpenAPI } from '../../../../src/types';
import { env } from '../../../../src/utils/env';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWN_LISTING_ID = '11111111-1111-4111-8111-111111111111';
const FOREIGN_LISTING_ID = '22222222-2222-4222-8222-222222222222';
const MISSING_LISTING_ID = '33333333-3333-4333-8333-333333333333';

const UMAMI_URL = 'https://umami.test';
const WEBSITE_ID = '44444444-4444-4444-8444-444444444444';
/** Placeholder, never a real credential. */
const UMAMI_KEY = 'test-placeholder-key';

const HOST_PERMISSIONS = [PermissionEnum.ACCOMMODATION_VIEW_OWN];

/** `x-mock-actor-*` is this app's route-test actor convention; `user-agent` is mandatory. */
function authHeaders(input?: {
    readonly id?: string;
    readonly role?: string;
    readonly permissions?: readonly string[];
}): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': input?.id ?? OWNER_ID,
        'x-mock-actor-role': input?.role ?? 'HOST',
        'x-mock-actor-permissions': JSON.stringify(input?.permissions ?? HOST_PERMISSIONS)
    };
}

function url(input: { type: string; id: string; query?: string }): string {
    return `/api/v1/protected/views/${input.type}/${input.id}/traffic-stats${input.query ?? ''}`;
}

/** Answers every Umami read with a plausible, well-formed payload. */
function umamiOk(requestUrl: string): Response {
    const path = new URL(requestUrl).pathname;
    if (path.endsWith('/metrics')) {
        return Response.json([
            { x: 'google.com', y: 7 },
            { x: 'AR', y: 3 }
        ]);
    }
    if (path.endsWith('/metrics/expanded')) {
        return Response.json([{ name: 'listing_internal_entry', pageviews: '4', visitors: 1 }]);
    }
    if (path.endsWith('/stats')) return Response.json({ pageviews: 10, visitors: 12 });
    if (path.endsWith('/event-data-pivot')) return Response.json({ count: 2 });
    return new Response('not found', { status: 404 });
}

const ENV_KEYS = [
    'HOSPEDA_UMAMI_URL',
    'HOSPEDA_UMAMI_WEBSITE_ID_WEB',
    'HOSPEDA_UMAMI_API_KEY'
] as const;
type MutableEnv = Record<(typeof ENV_KEYS)[number], string | undefined>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/protected/views/:entityType/:entityId/traffic-stats (HOS-2119 T-048)', () => {
    let app: AppOpenAPI;
    let fetchMock: ReturnType<typeof vi.fn>;
    const savedEnv: Partial<MutableEnv> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        const mutableEnv = env as unknown as MutableEnv;
        for (const key of ENV_KEYS) savedEnv[key] = mutableEnv[key];
        mutableEnv.HOSPEDA_UMAMI_URL = UMAMI_URL;
        mutableEnv.HOSPEDA_UMAMI_WEBSITE_ID_WEB = WEBSITE_ID;
        mutableEnv.HOSPEDA_UMAMI_API_KEY = UMAMI_KEY;
        _resetTrafficStatsServiceForTests();

        gateState.grantViewBasicStats = true;
        mockAccommodationIds.mockResolvedValue([OWN_LISTING_ID]);
        mockVenueIds.mockResolvedValue([OWN_LISTING_ID]);
        mockExperienceIds.mockResolvedValue([OWN_LISTING_ID]);

        fetchMock = vi.fn(async (input: string | URL | Request) => umamiOk(String(input)));
        vi.stubGlobal('fetch', fetchMock);

        app = initApp();
    });

    afterEach(() => {
        const mutableEnv = env as unknown as MutableEnv;
        for (const key of ENV_KEYS) mutableEnv[key] = savedEnv[key];
        _resetTrafficStatsServiceForTests();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    // -----------------------------------------------------------------------
    // 200: own listing, every served type
    // -----------------------------------------------------------------------

    describe('own listing (AC-7)', () => {
        it.each([
            { type: 'ACCOMMODATION', funnel: true },
            { type: 'VENUE', funnel: false },
            { type: 'EXPERIENCE', funnel: false }
        ])('answers 200 with data for $type', async ({ type, funnel }) => {
            // Arrange
            const permissions = type === 'ACCOMMODATION' ? HOST_PERMISSIONS : [];

            // Act
            const res = await app.request(url({ type, id: OWN_LISTING_ID }), {
                headers: authHeaders({ permissions })
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.available).toBe(true);
            expect(body.data.window).toBe('30d');
            // Umami: visitors 12, referrers 7 + 3 => 2 left: 1 internal-entry visitor
            // (the event row) and 1 direct.
            expect(body.data.referrers).toEqual([
                { value: 'google.com', count: 7 },
                { value: 'AR', count: 3 },
                { value: '(internal)', count: 1 },
                { value: '(direct)', count: 1 }
            ]);
            if (funnel) {
                expect(body.data.contactFunnel).toEqual({
                    views: 10,
                    contactStarted: 2,
                    contactCompleted: 2
                });
            } else {
                expect(body.data.contactFunnel).toBeNull();
            }
        });

        it('forwards the requested window and queries Umami only with the listing filter', async () => {
            // Act
            const res = await app.request(
                url({ type: 'VENUE', id: OWN_LISTING_ID, query: '?window=90d' }),
                { headers: authHeaders({ permissions: [] }) }
            );

            // Assert
            expect(res.status).toBe(200);
            expect((await res.json()).data.window).toBe('90d');
            expect(fetchMock).toHaveBeenCalled();
            for (const [calledUrl] of fetchMock.mock.calls) {
                const params = new URL(String(calledUrl)).searchParams;
                const filtered = params.get('tag') ?? params.get('pf_entity_id');
                expect(filtered).toContain(OWN_LISTING_ID);
            }
        });
    });

    // -----------------------------------------------------------------------
    // 401 / 403
    // -----------------------------------------------------------------------

    describe('authentication and gates', () => {
        it('answers 401 without a session and never reads ownership or Umami', async () => {
            // Act
            const res = await app.request(url({ type: 'ACCOMMODATION', id: OWN_LISTING_ID }), {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            // Assert
            expect(res.status).toBe(401);
            expect(mockAccommodationIds).not.toHaveBeenCalled();
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('answers 403 ENTITLEMENT_REQUIRED when the owner lacks view_basic_stats', async () => {
            // Arrange
            gateState.grantViewBasicStats = false;

            // Act
            const res = await app.request(url({ type: 'VENUE', id: OWN_LISTING_ID }), {
                headers: authHeaders({ permissions: [] })
            });

            // Assert
            expect(res.status).toBe(403);
            expect((await res.json()).error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(mockVenueIds).not.toHaveBeenCalled();
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('answers 403 FORBIDDEN for ACCOMMODATION without ACCOMMODATION_VIEW_OWN', async () => {
            // Act
            const res = await app.request(url({ type: 'ACCOMMODATION', id: OWN_LISTING_ID }), {
                headers: authHeaders({ permissions: [] })
            });

            // Assert
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe('FORBIDDEN');
            expect(body.error.message).not.toContain('ACCOMMODATION_VIEW_OWN');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('answers 403 (not 400) for ACCOMMODATION without the permission and an invalid id', async () => {
            // Act: the permission check runs before input validation.
            const res = await app.request(url({ type: 'ACCOMMODATION', id: 'not-a-uuid' }), {
                headers: authHeaders({ permissions: [] })
            });

            // Assert
            expect(res.status).toBe(403);
            expect((await res.json()).error.code).toBe('FORBIDDEN');
            expect(mockAccommodationIds).not.toHaveBeenCalled();
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // 404: ownership
    // -----------------------------------------------------------------------

    describe('ownership (AC-7)', () => {
        it.each([
            'ACCOMMODATION',
            'VENUE',
            'EXPERIENCE'
        ])('answers 404 for a listing owned by somebody else (%s) and never calls Umami', async (type) => {
            // Act
            const res = await app.request(url({ type, id: FOREIGN_LISTING_ID }), {
                headers: authHeaders({
                    permissions: type === 'ACCOMMODATION' ? HOST_PERMISSIONS : []
                })
            });

            // Assert
            expect(res.status).toBe(404);
            expect((await res.json()).error.code).toBe('NOT_FOUND');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('answers a foreign and a nonexistent listing with the SAME whole body', async () => {
            // Act
            const foreign = await app.request(url({ type: 'VENUE', id: FOREIGN_LISTING_ID }), {
                headers: authHeaders({ permissions: [] })
            });
            const missing = await app.request(url({ type: 'VENUE', id: MISSING_LISTING_ID }), {
                headers: authHeaders({ permissions: [] })
            });

            // Assert
            expect(foreign.status).toBe(404);
            expect(missing.status).toBe(404);
            // `metadata` carries the per-request id and timestamp; everything else must match.
            const { metadata: _foreignMeta, ...foreignBody } = await foreign.json();
            const { metadata: _missingMeta, ...missingBody } = await missing.json();
            expect(foreignBody).toEqual(missingBody);
            expect(foreignBody.error.code).toBe('NOT_FOUND');
        });

        it('scopes ownership by the actor id', async () => {
            // Act
            await app.request(url({ type: 'EXPERIENCE', id: OWN_LISTING_ID }), {
                headers: authHeaders({ permissions: [] })
            });

            // Assert
            expect(mockExperienceIds).toHaveBeenCalledWith(OWNER_ID);
        });
    });

    // -----------------------------------------------------------------------
    // 400: input shape
    // -----------------------------------------------------------------------

    describe('input shape', () => {
        it.each([
            { name: 'PARTNER (T-049)', type: 'PARTNER', id: OWN_LISTING_ID, query: '' },
            { name: 'POST', type: 'POST', id: OWN_LISTING_ID, query: '' },
            { name: 'a lowercase type', type: 'venue', id: OWN_LISTING_ID, query: '' },
            { name: 'a non-uuid id', type: 'VENUE', id: 'not-a-uuid', query: '' },
            {
                name: 'a window outside the enum',
                type: 'VENUE',
                id: OWN_LISTING_ID,
                query: '?window=14d'
            },
            { name: 'an empty window', type: 'VENUE', id: OWN_LISTING_ID, query: '?window=' }
        ])('answers 400 VALIDATION_ERROR for $name before touching the database', async (c) => {
            // Act
            const res = await app.request(url({ type: c.type, id: c.id, query: c.query }), {
                headers: authHeaders({ permissions: [] })
            });

            // Assert
            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
            expect(mockVenueIds).not.toHaveBeenCalled();
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // 200 available:false: Umami failures (AC-8)
    // -----------------------------------------------------------------------

    describe('Umami failure (AC-8)', () => {
        const UNAVAILABLE = {
            window: '30d',
            available: false,
            referrers: [],
            countries: [],
            devices: [],
            contactFunnel: null
        };

        it('answers 200 available:false when Umami answers 500', async () => {
            // Arrange
            fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

            // Act
            const res = await app.request(url({ type: 'ACCOMMODATION', id: OWN_LISTING_ID }), {
                headers: authHeaders()
            });

            // Assert
            expect(res.status).toBe(200);
            expect((await res.json()).data).toEqual(UNAVAILABLE);
        });

        it('answers 200 available:false when the Umami request rejects', async () => {
            // Arrange
            fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

            // Act
            const res = await app.request(url({ type: 'VENUE', id: OWN_LISTING_ID }), {
                headers: authHeaders({ permissions: [] })
            });

            // Assert
            expect(res.status).toBe(200);
            expect((await res.json()).data).toEqual(UNAVAILABLE);
        });

        it('answers 200 available:false within the 3 s budget when Umami hangs', async () => {
            // Arrange: a fetch that only settles when its request is aborted.
            fetchMock.mockImplementation(
                (_input: string | URL | Request, init?: RequestInit) =>
                    new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () =>
                            reject(new DOMException('aborted', 'AbortError'))
                        );
                    })
            );
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

            // Act
            const pending = app.request(url({ type: 'VENUE', id: OWN_LISTING_ID }), {
                headers: authHeaders({ permissions: [] })
            });
            await vi.advanceTimersByTimeAsync(3100);
            const res = await pending;

            // Assert
            expect(res.status).toBe(200);
            expect((await res.json()).data).toEqual(UNAVAILABLE);
        });
    });

    // -----------------------------------------------------------------------
    // 200 available:false: Umami not configured
    // -----------------------------------------------------------------------

    describe('Umami not configured', () => {
        it.each(
            ENV_KEYS
        )('answers 200 available:false without any outbound call when %s is unset', async (missingKey) => {
            // Arrange
            (env as unknown as MutableEnv)[missingKey] = undefined;
            _resetTrafficStatsServiceForTests();

            // Act
            const res = await app.request(
                url({ type: 'EXPERIENCE', id: OWN_LISTING_ID, query: '?window=7d' }),
                { headers: authHeaders({ permissions: [] }) }
            );

            // Assert
            expect(res.status).toBe(200);
            expect((await res.json()).data).toEqual({
                window: '7d',
                available: false,
                referrers: [],
                countries: [],
                devices: [],
                contactFunnel: null
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('still answers 404 for a foreign listing when Umami is not configured', async () => {
            // Arrange
            (env as unknown as MutableEnv).HOSPEDA_UMAMI_URL = undefined;
            _resetTrafficStatsServiceForTests();

            // Act
            const res = await app.request(url({ type: 'VENUE', id: FOREIGN_LISTING_ID }), {
                headers: authHeaders({ permissions: [] })
            });

            // Assert
            expect(res.status).toBe(404);
        });
    });
});
