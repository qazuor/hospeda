import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const mocks = vi.hoisted(() => ({
    getById: vi.fn(),
    findActiveForVenue: vi.fn()
}));

vi.mock('@repo/db', async (importActual) => ({
    ...(await importActual<typeof import('@repo/db')>()),
    ownerPromotionModel: { findActiveForVenue: mocks.findActiveForVenue }
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        VenueService: class {
            getById = mocks.getById;
        }
    };
});

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { publicGetVenuePromotionsRoute } = await import(
    '../../../../src/routes/venue/public/getPromotions.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');
const { Hono } = await import('hono');
const VENUE_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => vi.clearAllMocks());

function makeApp() {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((context, next) => {
        context.set('actor', {
            id: '11111111-1111-4111-8111-111111111111',
            roles: [],
            permissions: []
        } as never);
        return next();
    });
    app.route('/', publicGetVenuePromotionsRoute);
    return app;
}

describe('GET public venue promotions', () => {
    it('returns currently visible promotion records for a published venue', async () => {
        mocks.getById.mockResolvedValue({ data: { publicationStatus: 'PUBLISHED' } });
        mocks.findActiveForVenue.mockResolvedValue([
            {
                id: '33333333-3333-4333-8333-333333333333',
                title: 'Cena especial',
                description: null,
                discountType: 'percentage',
                discountValue: 20,
                validFrom: new Date('2026-11-01T00:00:00Z'),
                validUntil: null
            }
        ]);

        const response = await makeApp().request(`/${VENUE_ID}/promotions`);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            data: {
                items: [{ title: 'Cena especial', discountType: 'percentage', discountValue: 20 }]
            }
        });
    });

    it('returns 404 and skips promotion reads for an unpublished venue', async () => {
        mocks.getById.mockResolvedValue({ data: { publicationStatus: 'DRAFT' } });

        const response = await makeApp().request(`/${VENUE_ID}/promotions`);

        expect(response.status).toBe(404);
        expect(mocks.findActiveForVenue).not.toHaveBeenCalled();
    });
});
