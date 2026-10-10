import {
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../src/middlewares/response';
import { hostFavoritesBreakdownRoute } from '../../src/routes/accommodation/protected/hostFavoritesBreakdown';
import { hostMarketComparisonRoute } from '../../src/routes/accommodation/protected/hostMarketComparison';
import { hostConversationMonthlyInquiriesRoute } from '../../src/routes/conversations/protected/monthly-inquiries';
import { hostConversationResponseRateRoute } from '../../src/routes/conversations/protected/response-rate';
import { protectedExperienceViewStatsRoute } from '../../src/routes/experience/protected/viewStats';
import { protectedExperienceViewStatsDailySeriesRoute } from '../../src/routes/experience/protected/viewStatsDailySeries';
import { protectedGetGastronomyMenuQrRoute } from '../../src/routes/gastronomy/protected/menuQr';
import { protectedGetGastronomyMenuQrScansRoute } from '../../src/routes/gastronomy/protected/menuQrScans';
import { protectedGastronomyViewStatsRoute } from '../../src/routes/gastronomy/protected/viewStats';
import { protectedGastronomyViewStatsDailySeriesRoute } from '../../src/routes/gastronomy/protected/viewStatsDailySeries';
import { hostDashboardRoute } from '../../src/routes/host/protected/dashboard';
import { hostAccommodationViewStatsRoute } from '../../src/routes/views/protected/accommodations-me';
import { hostAccommodationDailySeriesRoute } from '../../src/routes/views/protected/daily-series';
import type { AppBindings } from '../../src/types';
import { createGuestActor } from '../../src/utils/actor';

const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    service: vi.fn(),
    qr: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    entityViewService: {
        getStatsForHostAccommodations: mocks.service,
        getDailySeriesForHostAccommodations: mocks.service,
        getStatsForOwnListings: mocks.service,
        getDailySeriesForOwnListings: mocks.service
    },
    AccommodationService: class {
        getHostMarketComparison = mocks.service;
        list = mocks.service;
        getByOwner = mocks.service;
    },
    UserBookmarkService: class {
        countBookmarksForEntity = mocks.service;
    },
    ConversationService: class {
        getHostMonthlyInquiries = mocks.service;
        getHostResponseRate = mocks.service;
        getUnreadCount = mocks.service;
    },
    GastronomyService: class {
        static ENTITY_NAME = 'gastronomy';
        getById = mocks.service;
    },
    QrCodeService: class {
        getOrCreateForEntity = mocks.qr;
        findLiveCodeForEntity = mocks.qr;
        getScanStatsForCode = mocks.qr;
    }
}));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));

const TRIAL = '11111111-1111-4111-8111-111111111111';
const BASIC = '22222222-2222-4222-8222-222222222222';
const PREMIUM = '33333333-3333-4333-8333-333333333333';
const GASTRO_BASIC = '44444444-4444-4444-8444-444444444444';
const GASTRO_PREMIUM = '55555555-5555-4555-8555-555555555555';
const LISTING = '66666666-6666-4666-8666-666666666666';
const baseSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'floor' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};

const rows = [
    {
        file: 'views/accommodations-me',
        route: hostAccommodationViewStatsRoute,
        path: '/accommodations/me',
        key: 'view_basic_stats',
        vertical: VerticalEnum.ACCOMMODATION,
        denied: TRIAL,
        allowed: BASIC,
        permission: PermissionEnum.ACCOMMODATION_VIEW_OWN
    },
    {
        file: 'views/daily-series',
        route: hostAccommodationDailySeriesRoute,
        path: '/accommodations/me/daily-series',
        key: 'view_basic_stats',
        vertical: VerticalEnum.ACCOMMODATION,
        denied: TRIAL,
        allowed: BASIC,
        permission: PermissionEnum.ACCOMMODATION_VIEW_OWN
    },
    {
        file: 'conversations/monthly-inquiries',
        route: hostConversationMonthlyInquiriesRoute,
        path: '/me/monthly-inquiries',
        key: 'view_basic_stats',
        vertical: VerticalEnum.ACCOMMODATION,
        denied: TRIAL,
        allowed: BASIC,
        permission: PermissionEnum.CONVERSATION_VIEW_OWN
    },
    {
        file: 'conversations/response-rate',
        route: hostConversationResponseRateRoute,
        path: '/me/response-rate',
        key: 'view_basic_stats',
        vertical: VerticalEnum.ACCOMMODATION,
        denied: TRIAL,
        allowed: BASIC,
        permission: PermissionEnum.CONVERSATION_VIEW_OWN
    },
    {
        file: 'accommodation/favorites-breakdown',
        route: hostFavoritesBreakdownRoute,
        path: '/my/favorites-breakdown',
        key: 'view_advanced_stats',
        vertical: VerticalEnum.ACCOMMODATION,
        denied: BASIC,
        allowed: PREMIUM
    },
    {
        file: 'accommodation/market-comparison',
        route: hostMarketComparisonRoute,
        path: '/my/market-comparison',
        key: 'view_advanced_stats',
        vertical: VerticalEnum.ACCOMMODATION,
        denied: BASIC,
        allowed: PREMIUM
    },
    {
        file: 'gastronomy/views',
        route: protectedGastronomyViewStatsRoute,
        path: '/mine/views',
        key: 'view_basic_stats',
        vertical: VerticalEnum.GASTRONOMY,
        denied: TRIAL,
        allowed: GASTRO_BASIC
    },
    {
        file: 'gastronomy/daily-series',
        route: protectedGastronomyViewStatsDailySeriesRoute,
        path: '/mine/views/daily-series',
        key: 'view_basic_stats',
        vertical: VerticalEnum.GASTRONOMY,
        denied: TRIAL,
        allowed: GASTRO_BASIC
    },
    {
        file: 'experience/views',
        route: protectedExperienceViewStatsRoute,
        path: '/mine/views',
        key: 'view_basic_stats',
        vertical: VerticalEnum.EXPERIENCE,
        denied: TRIAL,
        allowed: BASIC
    },
    {
        file: 'experience/daily-series',
        route: protectedExperienceViewStatsDailySeriesRoute,
        path: '/mine/views/daily-series',
        key: 'view_basic_stats',
        vertical: VerticalEnum.EXPERIENCE,
        denied: TRIAL,
        allowed: BASIC
    },
    {
        file: 'gastronomy/menu-qr',
        route: protectedGetGastronomyMenuQrRoute,
        path: `/${LISTING}/menu-qr`,
        key: 'menu_qr_scan_metrics',
        vertical: VerticalEnum.GASTRONOMY,
        denied: GASTRO_BASIC,
        allowed: GASTRO_PREMIUM,
        resource: true
    },
    {
        file: 'gastronomy/menu-qr-scans',
        route: protectedGetGastronomyMenuQrScansRoute,
        path: `/${LISTING}/menu-qr/scans`,
        key: 'menu_qr_scan_metrics',
        vertical: VerticalEnum.GASTRONOMY,
        denied: GASTRO_BASIC,
        allowed: GASTRO_PREMIUM,
        resource: true
    },
    {
        file: 'host/dashboard',
        route: hostDashboardRoute,
        path: '/dashboard',
        key: 'view_basic_stats',
        vertical: VerticalEnum.ACCOMMODATION,
        denied: TRIAL,
        allowed: BASIC,
        dashboard: true
    }
] as const;

function makeApp(
    row: (typeof rows)[number],
    actorId: string,
    permissions: readonly PermissionEnum[] = Object.values(PermissionEnum)
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((ctx, next) => {
        ctx.set(
            'actor',
            actorId === 'guest'
                ? createGuestActor()
                : {
                      id: actorId,
                      roles: [RoleEnum.HOST],
                      permissions,
                      emailVerified: true
                  }
        );
        return next();
    });
    app.route('/case', row.route);
    return app;
}

async function request(
    row: (typeof rows)[number],
    actorId: string,
    path: string = row.path,
    permissions?: readonly PermissionEnum[]
) {
    return makeApp(row, actorId, permissions).request(`/case${path}`, { method: 'GET' });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) => {
            const keys =
                userId === BASIC ||
                userId === PREMIUM ||
                userId === GASTRO_BASIC ||
                userId === GASTRO_PREMIUM
                    ? ['view_basic_stats']
                    : [];
            if (userId === PREMIUM) keys.push('view_advanced_stats');
            if (userId === GASTRO_PREMIUM) keys.push('menu_qr_scan_metrics');
            return rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const }))
            });
        }
    );
    mocks.coverage.mockResolvedValue({ covered: false, sources: [baseSource] });
    mocks.loadFacts.mockImplementation(async ({ listingId }: { listingId: string }) => ({
        facts:
            listingId === LISTING
                ? { ownerId: GASTRO_PREMIUM, publicationStatus: PublicationStatusEnum.PUBLISHED }
                : null,
        ownerId: listingId === LISTING ? GASTRO_PREMIUM : null
    }));
    mocks.service.mockResolvedValue({ data: [] });
    mocks.qr.mockResolvedValue({ data: null });
});

describe('TEST:V5:32 stats gates', () => {
    it('dashboard keeps plan null only after view_basic_stats is granted', async () => {
        const row = rows.find((candidate) => candidate.file === 'host/dashboard');
        if (!row) throw new Error('Dashboard route case missing');
        const denied = await request(row, TRIAL);
        expect(denied.status).toBe(403);
        expect((await denied.json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'view_basic_stats' }
        });
        expect(mocks.service).not.toHaveBeenCalled();
        mocks.service.mockResolvedValue({ data: { accommodations: [] } });
        const allowed = await request(row, BASIC);
        expect(allowed.status).toBe(200);
        expect((await allowed.json()).data.plan).toBeNull();
    });

    it.each(
        rows
    )('$file rejects the owner without the effective key before calling its service', async (row) => {
        if ('resource' in row)
            mocks.loadFacts.mockResolvedValue({
                facts: { ownerId: row.denied, publicationStatus: PublicationStatusEnum.PUBLISHED },
                ownerId: row.denied
            });
        const response = await request(row, row.denied);
        expect(response.status, row.file).toBe(403);
        expect((await response.json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: row.key }
        });
        expect(mocks.service).not.toHaveBeenCalled();
        expect(mocks.qr).not.toHaveBeenCalled();
    });

    it.each(
        rows
    )('$file accepts the owner with the effective key and reads the correct scope', async (row) => {
        if ('resource' in row)
            mocks.loadFacts.mockResolvedValue({
                facts: { ownerId: row.allowed, publicationStatus: PublicationStatusEnum.PUBLISHED },
                ownerId: row.allowed
            });
        if ('dashboard' in row) mocks.service.mockResolvedValue({ data: { accommodations: [] } });
        if (row.file === 'conversations/response-rate') {
            mocks.service.mockResolvedValue({
                data: { responseRatePct: 0, avgResponseTimeMinutes: null }
            });
        }
        if ('resource' in row)
            mocks.service.mockResolvedValue({
                data: { id: LISTING, ownerId: row.allowed, slug: 'venue', name: 'Venue' }
            });
        if (row.file === 'gastronomy/menu-qr') {
            mocks.qr.mockImplementation(async (input: { targetUrl: string }) => ({
                data: { id: LISTING, slug: 'qrslug', targetUrl: input.targetUrl }
            }));
        }
        const response = await request(row, row.allowed);
        const body = await response.json().catch(() => ({}));
        expect(response.status, row.file).toBe(200);
        expect(body.error?.code, row.file).not.toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        expect(mocks.effectiveSet).toHaveBeenCalledWith({
            userId: row.allowed,
            vertical: row.vertical
        });
        if ('dashboard' in row) expect(body.data.plan).toBeNull();
    });

    it.each(rows)('$file preserves guest and input-shape priority', async (row) => {
        expect((await request(row, 'guest')).status).toBe(401);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        const invalidPath =
            'resource' in row
                ? `/bad-id${row.path.slice(row.path.indexOf('/', 1))}`
                : `${row.path}?window=invalid`;
        if (
            row.path.includes('daily-series') ||
            row.path.endsWith('/views') ||
            row.path.endsWith('/accommodations/me')
        ) {
            expect((await request(row, row.denied, invalidPath)).status).toBe(400);
            expect(mocks.effectiveSet).not.toHaveBeenCalled();
        }
        if (row.file === 'conversations/monthly-inquiries') {
            expect((await request(row, row.denied, `${row.path}?months=0`)).status).toBe(400);
            expect(mocks.effectiveSet).not.toHaveBeenCalled();
        }
        if ('resource' in row) {
            expect((await request(row, row.denied, invalidPath)).status).toBe(400);
            expect(mocks.effectiveSet).not.toHaveBeenCalled();
        }
    });

    it.each(
        rows.filter((row) => 'permission' in row)
    )('$file checks permission before entitlement', async (row) => {
        const response = await request(row, row.denied, row.path, []);
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

    it.each(
        rows.filter((row) => 'resource' in row)
    )('$file returns 404 for a foreign or absent listing before the key', async (row) => {
        const permissions = Object.values(PermissionEnum).filter(
            (permission) => permission !== PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
        );
        const foreign = await request(row, row.denied, row.path, permissions);
        expect(foreign.status).toBe(404);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        mocks.loadFacts.mockResolvedValue({ facts: null, ownerId: null });
        const missing = await request(row, row.denied, row.path, permissions);
        expect(missing.status).toBe(404);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });
});
