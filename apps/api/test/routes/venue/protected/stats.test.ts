import { PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const { mockGetStatsForVenue, mockLoadFacts } = vi.hoisted(() => ({
    mockGetStatsForVenue: vi.fn(),
    mockLoadFacts: vi.fn()
}));
let granted = true;

vi.mock('@repo/service-core', async (importActual) => ({
    ...(await importActual<typeof import('@repo/service-core')>()),
    entityViewService: { getStatsForVenue: mockGetStatsForVenue }
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mockLoadFacts,
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: granted ? [{ key: 'view_advanced_stats', value: 1, strategy: 'MAX' }] : []
            })
    })
}));
vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedGetVenueStatsRoute } = await import(
    '../../../../src/routes/venue/protected/stats.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER_ID = '99999999-9999-4999-8999-999999999999';
const VENUE_ID = '22222222-2222-4222-8222-222222222222';

function buildApp(actorId = OWNER_ID): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((context, next) => {
        context.set('actor', { id: actorId, roles: [], permissions: [] } as never);
        return next();
    });
    app.route('/', protectedGetVenueStatsRoute);
    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    granted = true;
    mockLoadFacts.mockImplementation(async ({ listingId }: { listingId: string }) => ({
        facts:
            listingId === VENUE_ID
                ? { ownerId: OWNER_ID, publicationStatus: PublicationStatusEnum.PUBLISHED }
                : null,
        ownerId: listingId === VENUE_ID ? OWNER_ID : null
    }));
    mockGetStatsForVenue.mockResolvedValue({
        data: {
            window: '30d',
            views: { unique: 1, total: 2 },
            dailyViews: [],
            clicks: {
                total: 1,
                byKind: {
                    PHONE_CLICK: { unique: 1, total: 1 },
                    MAP_CLICK: { unique: 0, total: 0 },
                    WEBSITE_CLICK: { unique: 0, total: 0 },
                    INSTAGRAM_CLICK: { unique: 0, total: 0 },
                    TICKET_CLICK: { unique: 0, total: 0 },
                    WHATSAPP_CLICK: { unique: 0, total: 0 }
                }
            },
            clickRate: 0.5
        }
    });
});

describe('GET /{id}/stats (HOS-2261)', () => {
    it('returns the selected window metrics for an authorized venue owner', async () => {
        const response = await buildApp().request(`/${VENUE_ID}/stats?window=90d`);
        expect(response.status).toBe(200);
        expect(mockGetStatsForVenue).toHaveBeenCalledWith(
            expect.objectContaining({ venueId: VENUE_ID, window: '90d' })
        );
    });

    it('rejects an owner without view_advanced_stats in the venue vertical', async () => {
        granted = false;
        const response = await buildApp().request(`/${VENUE_ID}/stats`);
        expect(response.status).toBe(403);
        expect((await response.json()).error).toMatchObject({
            code: 'ENTITLEMENT_REQUIRED',
            details: { entitlementKey: 'view_advanced_stats' }
        });
        expect(mockGetStatsForVenue).not.toHaveBeenCalled();
    });

    it('returns the same 404 for a foreign and missing venue, and 400 for an invalid id', async () => {
        const foreign = await buildApp(OTHER_OWNER_ID).request(`/${VENUE_ID}/stats`);
        mockLoadFacts.mockResolvedValue({ facts: null, ownerId: null });
        const missing = await buildApp().request(`/${VENUE_ID}/stats`);
        const invalid = await buildApp().request('/bad-id/stats');
        expect(foreign.status).toBe(404);
        expect(missing.status).toBe(404);
        expect((await foreign.json()).error).toEqual((await missing.json()).error);
        expect(invalid.status).toBe(400);
        expect(mockGetStatsForVenue).not.toHaveBeenCalled();
    });
});
