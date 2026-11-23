/**
 * Tests for GET /api/v1/protected/{venues|experiences}/mine/stats (HOS-2475 / HOS-2476).
 *
 * There is no `:id` in these paths, so the "foreign resource answers 404" rule
 * cannot be exercised literally. Its equivalent is structural scoping: the
 * handler hands the service the CALLER's actor and nothing else, so a second
 * owner's listings are never counted. The scoping tests below prove it with two
 * owners whose data differ.
 *
 * The permission (VENUE_EDIT_OWN / EXPERIENCE_EDIT_OWN) is checked in the
 * service, not declared on the route: a closed-list READ_OWN route may not name
 * it (TEST:1692:7). An actor without it answers 403 before any data read.
 */
import { PermissionEnum, PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types.js';
import { APP_IMPORT_TIMEOUT_MS } from '../helpers/app-import-timeout';

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '99999999-9999-4999-8999-999999999999';

const mocks = vi.hoisted(() => ({
    count: vi.fn(),
    getStats: vi.fn()
}));
let granted = true;
let effectiveSetFails = false;

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        // The service builds its own readers inside the package, so the seam is its
        // constructor ports, not the re-exported Venue/Experience classes.
        OwnerListingDashboardService: class extends actual.OwnerListingDashboardService {
            constructor(ctx: ConstructorParameters<typeof actual.OwnerListingDashboardService>[0]) {
                super({
                    ...ctx,
                    venueModel: { count: mocks.count },
                    experienceModel: { count: mocks.count },
                    entityViewService: { getStatsForOwnListings: mocks.getStats }
                });
            }
        }
    };
});
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) => {
            if (effectiveSetFails) throw new Error('effective set store unreachable');
            return rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: granted ? [{ key: 'view_basic_stats', value: 1, strategy: 'MAX' }] : []
            });
        }
    })
}));
vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { createErrorHandler } = await import('../../src/middlewares/response.js');
const { protectedVenueMineStatsRoute } = await import(
    '../../src/routes/venue/protected/mineStats.js'
);
const { protectedExperienceMineStatsRoute } = await import(
    '../../src/routes/experience/protected/mineStats.js'
);

/** Listings keyed by owner: the fake table behind the model `count`. */
const LISTINGS_BY_OWNER: Record<string, Array<{ publicationStatus: PublicationStatusEnum }>> = {
    [OWNER_A]: [
        { publicationStatus: PublicationStatusEnum.PUBLISHED },
        { publicationStatus: PublicationStatusEnum.DRAFT }
    ],
    [OWNER_B]: [
        { publicationStatus: PublicationStatusEnum.PUBLISHED },
        { publicationStatus: PublicationStatusEnum.PUBLISHED },
        { publicationStatus: PublicationStatusEnum.PUBLISHED }
    ]
};
const VIEWS_BY_OWNER: Record<string, Array<{ unique: number; total: number }>> = {
    [OWNER_A]: [{ unique: 2, total: 4 }],
    [OWNER_B]: [{ unique: 50, total: 90 }]
};

/** Both owner permissions; each route needs its own vertical's. */
const OWNER_PERMISSIONS = [PermissionEnum.VENUE_EDIT_OWN, PermissionEnum.EXPERIENCE_EDIT_OWN];

function buildApp(
    route: typeof protectedVenueMineStatsRoute,
    actorId: string | null,
    permissions: readonly PermissionEnum[] = OWNER_PERMISSIONS
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((context, next) => {
        if (actorId) context.set('actor', { id: actorId, roles: ['USER'], permissions } as never);
        return next();
    });
    app.route('/', route);
    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    granted = true;
    effectiveSetFails = false;
    // A COUNT over the fake table, honouring the ownerId / publicationStatus filter.
    mocks.count.mockImplementation(
        async (where: { ownerId: string; publicationStatus?: PublicationStatusEnum }) =>
            (LISTINGS_BY_OWNER[where.ownerId] ?? []).filter(
                (row) =>
                    where.publicationStatus === undefined ||
                    row.publicationStatus === where.publicationStatus
            ).length
    );
    mocks.getStats.mockImplementation(async ({ actor }: { actor: { id: string } }) => ({
        data: VIEWS_BY_OWNER[actor.id] ?? []
    }));
});

describe.each([
    ['venue', protectedVenueMineStatsRoute],
    ['experience', protectedExperienceMineStatsRoute]
] as const)('GET /mine/stats (%s)', (vertical, route) => {
    it('answers 200 granted with counts and traffic for the selected window', async () => {
        const res = await buildApp(route, OWNER_A).request('/mine/stats?window=7d');
        expect(res.status).toBe(200);
        const body = (await res.json()).data;
        expect(body).toEqual({
            vertical,
            listings: { total: 2, published: 1, draft: 1, archived: 0 },
            trafficAccess: 'granted',
            traffic: { windowDays: 7, unique: 2, total: 4 }
        });
    });

    it('answers 403 FORBIDDEN, reading nothing, without the vertical owner permission', async () => {
        // Arrange: an account holding only the OTHER vertical's permission.
        const other =
            vertical === 'venue'
                ? PermissionEnum.EXPERIENCE_EDIT_OWN
                : PermissionEnum.VENUE_EDIT_OWN;
        // Act
        const res = await buildApp(route, OWNER_A, [other]).request('/mine/stats');
        // Assert
        expect(res.status).toBe(403);
        expect((await res.json()).error.code).toBe('FORBIDDEN');
        expect(mocks.count).not.toHaveBeenCalled();
        expect(mocks.getStats).not.toHaveBeenCalled();
    });

    it('defaults an unsupported window to 30d', async () => {
        const res = await buildApp(route, OWNER_A).request('/mine/stats?window=90d');
        expect(res.status).toBe(200);
        expect((await res.json()).data.traffic.windowDays).toBe(30);
    });

    it('answers locked with NO traffic key when the entitlement is absent', async () => {
        granted = false;
        const res = await buildApp(route, OWNER_A).request('/mine/stats');
        expect(res.status).toBe(200);
        const body = (await res.json()).data;
        expect(body.trafficAccess).toBe('locked');
        expect(body).not.toHaveProperty('traffic');
        expect(body.listings.total).toBe(2);
        expect(mocks.getStats).not.toHaveBeenCalled();
    });

    it('answers unavailable, NOT locked, when the entitlement read itself fails', async () => {
        // Arrange: a paying owner whose effective set cannot be read right now.
        effectiveSetFails = true;
        // Act
        const res = await buildApp(route, OWNER_A).request('/mine/stats');
        // Assert: no upsell for a transient failure.
        expect(res.status).toBe(200);
        const body = (await res.json()).data;
        expect(body.trafficAccess).toBe('unavailable');
        expect(body).not.toHaveProperty('traffic');
        expect(mocks.getStats).not.toHaveBeenCalled();
    });

    it('answers unavailable with NO traffic key when the view read fails', async () => {
        mocks.getStats.mockResolvedValue({ error: { code: 'INTERNAL_ERROR', message: 'x' } });
        const res = await buildApp(route, OWNER_A).request('/mine/stats');
        const body = (await res.json()).data;
        expect(body.trafficAccess).toBe('unavailable');
        expect(body).not.toHaveProperty('traffic');
    });

    it('answers an error, not zero counts, when the listings read fails', async () => {
        mocks.count.mockRejectedValue(new Error('db down'));
        const res = await buildApp(route, OWNER_A).request('/mine/stats');
        expect(res.status).toBe(500);
    });

    it("never counts a second owner's listings (structural scoping, no id in the path)", async () => {
        // Arrange / Act
        const res = await buildApp(route, OWNER_A).request('/mine/stats');
        const body = (await res.json()).data;
        // Assert: owner A sees A's numbers only, and both reads got A's actor.
        expect(body.listings.total).toBe(2);
        expect(body.traffic).toEqual({ windowDays: 30, unique: 2, total: 4 });
        for (const [where] of mocks.count.mock.calls) {
            expect(where).toMatchObject({ ownerId: OWNER_A });
        }
        expect(mocks.getStats).toHaveBeenCalledWith(
            expect.objectContaining({ actor: expect.objectContaining({ id: OWNER_A }) })
        );
        // And B, asking the same URL, gets B's own numbers.
        const resB = await buildApp(route, OWNER_B).request('/mine/stats');
        expect((await resB.json()).data.listings.total).toBe(3);
    });
});

describe.each([
    'venues',
    'experiences'
] as const)('GET /api/v1/protected/%s/mine/stats through the full app', (segment) => {
    it(
        'answers 401 without a session, and is not swallowed by /{id}/stats',
        async () => {
            // Arrange
            const { initApp } = await import('../../src/app.js');
            const app = initApp();
            // Act
            const res = await app.request(`/api/v1/protected/${segment}/mine/stats`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest' }
            });
            // Assert
            expect(res.status).toBe(401);
            expect(mocks.count).not.toHaveBeenCalled();
        },
        APP_IMPORT_TIMEOUT_MS
    );
});
