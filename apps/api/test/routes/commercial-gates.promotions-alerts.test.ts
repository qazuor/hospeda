import { PermissionEnum, RoleEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../src/middlewares/response';
import { protectedGetWhatsAppRoute } from '../../src/routes/accommodation/protected/getWhatsApp';
import { protectedCreateOwnerPromotionRoute } from '../../src/routes/owner-promotion/protected/create';
import { protectedPatchOwnerPromotionRoute } from '../../src/routes/owner-promotion/protected/patch';
import { protectedUpdateOwnerPromotionRoute } from '../../src/routes/owner-promotion/protected/update';
import { createPriceAlertRoute } from '../../src/routes/price-alert/protected/create';
import { publicGetVenueBySlugRoute } from '../../src/routes/venue/public/getBySlug';
import type { AppBindings } from '../../src/types';
import { createGuestActor } from '../../src/utils/actor';

const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    promotionCount: vi.fn(),
    promotionGet: vi.fn(),
    promotionCreate: vi.fn(),
    promotionUpdate: vi.fn(),
    alertCount: vi.fn(),
    alertCreate: vi.fn(),
    accommodationGet: vi.fn(),
    venueGetBySlug: vi.fn(),
    menu: vi.fn(),
    events: vi.fn(),
    dailySpecials: vi.fn(),
    amenities: vi.fn(),
    features: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        OwnerPromotionService: class {
            count = mocks.promotionCount;
            getById = mocks.promotionGet;
            create = mocks.promotionCreate;
            update = mocks.promotionUpdate;
        },
        AlertSubscriptionService: class {
            countActive = mocks.alertCount;
            create = mocks.alertCreate;
        },
        AccommodationService: class {
            getById = mocks.accommodationGet;
        },
        VenueService: class {
            model = {};
            getBySlug = mocks.venueGetBySlug;
        },
        getVenueMenu: mocks.menu,
        getVenueEvents: mocks.events,
        getVenueDailySpecials: mocks.dailySpecials
    };
});

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));
vi.mock('../../src/utils/listing-catalog-relations', () => ({
    fetchVenueAmenities: mocks.amenities,
    fetchVenueFeatures: mocks.features
}));

const IDS = {
    ownerBasic: '11111111-1111-4111-8111-111111111111',
    ownerPremium: '22222222-2222-4222-8222-222222222222',
    trial: '33333333-3333-4333-8333-333333333333',
    touristVip: '44444444-4444-4444-8444-444444444444',
    touristFloor: '55555555-5555-4555-8555-555555555555',
    gastroPro: '66666666-6666-4666-8666-666666666666',
    gastroBasic: '77777777-7777-4777-8777-777777777777',
    listing: '88888888-8888-4888-8888-888888888888'
} as const;

const REQUEST_HEADERS = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    accept: 'application/json'
};

async function updatePromotion(
    route: Hono<AppBindings>,
    actorId: string,
    method: 'PATCH' | 'PUT',
    id = '99999999-9999-4999-8999-999999999999',
    permissions: readonly PermissionEnum[] = Object.values(PermissionEnum)
) {
    return makeApp(route, actorId, permissions).request(`/case/${id}`, {
        method,
        headers: REQUEST_HEADERS,
        body: JSON.stringify({ title: 'changed' })
    });
}

const BASE_PROMOTION = {
    id: '99999999-9999-4999-8999-999999999999',
    slug: 'summer-deal',
    ownerId: IDS.ownerPremium,
    accommodationId: null,
    title: 'Summer deal',
    description: null,
    discountType: 'percentage',
    discountValue: 10,
    minNights: null,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    maxRedemptions: null,
    currentRedemptions: 0,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};
const MENU_SECTION = {
    id: '11111111-1111-4111-8111-111111111112',
    gastronomyId: IDS.listing,
    name: 'Entradas',
    description: null,
    nameI18n: { es: 'Entradas', en: 'Starters', pt: 'Entradas' },
    descriptionI18n: null,
    displayOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    items: [
        {
            id: '11111111-1111-4111-8111-111111111113',
            sectionId: '11111111-1111-4111-8111-111111111112',
            gastronomyId: IDS.listing,
            name: 'Empanada',
            description: null,
            nameI18n: { es: 'Empanada', en: 'Empanada', pt: 'Empanada' },
            descriptionI18n: null,
            priceCents: 1000,
            isAvailable: true,
            photoUrl: 'https://example.com/empanada.jpg',
            photoPublicId: 'private-id',
            photoAlt: 'Empanada',
            displayOrder: 0,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z')
        }
    ]
};
const VENUE_EVENT = {
    id: '11111111-1111-4111-8111-111111111114',
    gastronomyId: IDS.listing,
    title: 'Happy hour',
    description: null,
    recurrence: 'weekly',
    date: null,
    weekday: 4,
    startTime: '18:00',
    endTime: '20:00',
    isActive: true,
    displayOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
};
const DAILY_SPECIAL = {
    id: '11111111-1111-4111-8111-111111111115',
    gastronomyId: IDS.listing,
    title: 'Ravioles',
    description: null,
    priceCents: 2500,
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    displayOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
};
const VENUE = {
    id: IDS.listing,
    slug: 'la-parrilla',
    name: 'La Parrilla',
    type: 'PARRILLA',
    summary: 'A test venue',
    description: 'A test venue description',
    destinationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ownerId: IDS.gastroPro,
    publicationStatus: 'PUBLISHED',
    averageRating: 0,
    reviewsCount: 0,
    media: null,
    videos: null,
    seo: null,
    tags: [],
    socialNetworks: null,
    openingHours: null,
    nameI18n: null,
    summaryI18n: null,
    descriptionI18n: null,
    menuFileUrl: 'https://example.com/menu.pdf',
    menuFileKind: 'pdf',
    menuUrl: null,
    priceRange: null,
    rating: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
};
function makeApp(
    route: Hono<AppBindings>,
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
    app.route('/case', route);
    return app;
}

async function post(
    route: Hono<AppBindings>,
    actorId: string,
    body: unknown,
    path = '/case',
    permissions: readonly PermissionEnum[] = Object.values(PermissionEnum)
) {
    return makeApp(route, actorId, permissions).request(path, {
        method: 'POST',
        headers: REQUEST_HEADERS,
        body: JSON.stringify(body)
    });
}

function effectiveKeys(userId: string, vertical: VerticalEnum): string[] {
    if (userId === IDS.ownerBasic) return ['create_promotions'];
    if (userId === IDS.ownerPremium) return ['create_promotions'];
    if (userId === IDS.touristVip) return ['price_alerts', 'can_contact_whatsapp_display'];
    if (userId === IDS.gastroPro) {
        return ['manage_gastronomy_menu', 'menu_item_photos', 'multilingual_gastronomy_menu'];
    }
    if (vertical === VerticalEnum.TOURIST && userId === IDS.touristFloor) return [];
    return [];
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.effectiveSet.mockImplementation(async ({ userId, vertical }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: true,
            inheritsTouristVip: false,
            entries: effectiveKeys(userId, vertical)
                .map((key) => ({
                    key,
                    value: 1,
                    strategy: 'MAX' as const
                }))
                .concat(
                    userId === IDS.ownerBasic || userId === IDS.ownerPremium
                        ? [
                              {
                                  key: 'max_active_promotions',
                                  value: userId === IDS.ownerBasic ? 2 : 2147483647,
                                  strategy: 'MAX' as const
                              }
                          ]
                        : userId === IDS.touristVip
                          ? [
                                {
                                    key: 'max_active_alerts',
                                    value: 2147483647,
                                    strategy: 'MAX' as const
                                }
                            ]
                          : []
                )
        })
    );
    mocks.promotionCount.mockResolvedValue({ data: { count: 2 }, error: undefined });
    mocks.promotionGet.mockResolvedValue({ data: BASE_PROMOTION, error: undefined });
    mocks.promotionCreate.mockResolvedValue({ data: BASE_PROMOTION, error: undefined });
    mocks.promotionUpdate.mockResolvedValue({ data: BASE_PROMOTION, error: undefined });
    mocks.alertCount.mockResolvedValue({ data: { count: 0 }, error: undefined });
    mocks.alertCreate.mockResolvedValue({
        data: {
            id: IDS.listing,
            accommodationId: IDS.listing,
            userId: IDS.touristVip,
            basePriceSnapshot: 10000,
            targetPercentDrop: null,
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            deletedAt: null
        },
        error: undefined
    });
    mocks.accommodationGet.mockResolvedValue({
        data: {
            id: IDS.listing,
            name: 'Cabin',
            ownerId: IDS.ownerBasic,
            publicationStatus: 'PUBLISHED',
            contactInfo: { whatsapp: '+541234567890' }
        },
        error: undefined
    });
    mocks.venueGetBySlug.mockResolvedValue({ data: VENUE, error: undefined });
    mocks.menu.mockResolvedValue({ data: { sections: [MENU_SECTION] }, error: undefined });
    mocks.events.mockResolvedValue({ data: { events: [VENUE_EVENT] }, error: undefined });
    mocks.dailySpecials.mockResolvedValue({
        data: { specials: [DAILY_SPECIAL] },
        error: undefined
    });
    mocks.amenities.mockResolvedValue([]);
    mocks.features.mockResolvedValue([]);
});

const PROMOTION_BODY = {
    title: 'x',
    discountType: 'percentage',
    discountValue: 10,
    validFrom: '2026-01-01T00:00:00.000Z'
};

describe('TEST:V5:32 promotions, alerts and paid public fields', () => {
    it('keeps guest, permission and input-shape errors ahead of effective-set reads', async () => {
        const guest = await post(protectedCreateOwnerPromotionRoute, 'guest', PROMOTION_BODY);
        expect(guest.status).toBe(401);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();

        const forbidden = await post(
            protectedCreateOwnerPromotionRoute,
            IDS.trial,
            PROMOTION_BODY,
            '/case',
            []
        );
        expect(forbidden.status).toBe(403);
        expect((await forbidden.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();

        const invalidPromotion = await post(protectedCreateOwnerPromotionRoute, IDS.trial, {
            ...PROMOTION_BODY,
            discountType: 'unknown'
        });
        expect(invalidPromotion.status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();

        const invalidAlert = await post(createPriceAlertRoute, IDS.touristVip, {
            accommodationId: 'bad-id'
        });
        expect(invalidAlert.status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

    it('owner promotion creation requires the key and counts ACTIVE rows before adding one', async () => {
        const denied = await post(protectedCreateOwnerPromotionRoute, IDS.trial, PROMOTION_BODY);
        expect(denied.status, JSON.stringify(await denied.clone().json())).toBe(403);
        expect((await denied.json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'create_promotions' }
        });
        expect(mocks.promotionCount).not.toHaveBeenCalled();
        const limited = await post(
            protectedCreateOwnerPromotionRoute,
            IDS.ownerBasic,
            PROMOTION_BODY
        );
        expect(limited.status).toBe(403);
        expect((await limited.json()).error).toMatchObject({
            code: ServiceErrorCode.LIMIT_REACHED,
            details: { limitKey: 'max_active_promotions', maxAllowed: 2 }
        });
        mocks.promotionCount.mockResolvedValue({ data: { count: 0 }, error: undefined });
        const allowed = await post(
            protectedCreateOwnerPromotionRoute,
            IDS.ownerPremium,
            PROMOTION_BODY
        );
        expect(allowed.status).toBe(201);
    });

    it.each([
        ['PATCH', protectedPatchOwnerPromotionRoute],
        ['PUT', protectedUpdateOwnerPromotionRoute]
    ] as const)('%s checks permission and ownership before the promotion key', async (method, route) => {
        const forbidden = await updatePromotion(route, IDS.trial, method, undefined, []);
        expect(forbidden.status).toBe(403);
        expect((await forbidden.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        expect(mocks.promotionGet).not.toHaveBeenCalled();

        const malformedId = await updatePromotion(route, IDS.trial, method, 'not-a-uuid');
        expect(malformedId.status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        expect(mocks.promotionGet).not.toHaveBeenCalled();

        mocks.promotionGet.mockResolvedValue({
            data: null,
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Owner promotion not found' }
        });
        const foreign = await updatePromotion(route, IDS.trial, method);
        expect(foreign.status).toBe(404);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();

        mocks.promotionGet.mockResolvedValue({
            data: { ...BASE_PROMOTION, ownerId: IDS.trial },
            error: undefined
        });
        const denied = await updatePromotion(route, IDS.trial, method);
        expect(denied.status).toBe(403);
        expect((await denied.json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'create_promotions' }
        });

        mocks.promotionGet.mockResolvedValue({
            data: { ...BASE_PROMOTION, ownerId: IDS.ownerPremium },
            error: undefined
        });
        const allowed = await updatePromotion(route, IDS.ownerPremium, method);
        expect(allowed.status).toBe(200);
    });

    it('price alerts gate the tourist key before counting and permit the paid tourist', async () => {
        const body = { accommodationId: IDS.listing, targetPercentDrop: 10 };
        const floor = await post(createPriceAlertRoute, IDS.touristFloor, body);
        expect(floor.status).toBe(403);
        expect((await floor.json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'price_alerts' }
        });
        expect(mocks.alertCount).not.toHaveBeenCalled();
        const vip = await post(createPriceAlertRoute, IDS.touristVip, body);
        expect(vip.status).toBe(201);
        expect(mocks.alertCount).toHaveBeenCalledTimes(1);
    });

    it('WhatsApp stays 200 and derives display/direct flags from the viewer', async () => {
        const app = makeApp(protectedGetWhatsAppRoute, IDS.touristVip);
        const entitled = await app.request(`/case/${IDS.listing}/whatsapp`);
        expect(entitled.status).toBe(200);
        expect((await entitled.json()).data.entitled).toBe(true);
        const denied = await makeApp(protectedGetWhatsAppRoute, IDS.touristFloor).request(
            `/case/${IDS.listing}/whatsapp`
        );
        expect(denied.status).toBe(200);
        expect((await denied.json()).data.entitled).toBe(false);
    });

    it('gastronomy paid public fields follow the owner set regardless of the viewer', async () => {
        const app = makeApp(publicGetVenueBySlugRoute, IDS.touristVip);
        const response = await app.request('/case/slug/la-parrilla');
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
        const data = (await response.json()).data;
        expect(data.menuFileUrl).toBe('https://example.com/menu.pdf');
        expect(data.menuSections[0].nameI18n.en).toBe('Starters');
        expect(data.menuSections[0].items[0].photoUrl).toBe('https://example.com/empanada.jpg');
        expect(data.menuSections[0].items[0]).not.toHaveProperty('photoPublicId');
        expect(data.venueEvents).toBeUndefined();
        expect(data.dailySpecials).toBeUndefined();
        expect(mocks.effectiveSet).toHaveBeenCalledWith({
            userId: IDS.gastroPro,
            vertical: VerticalEnum.VENUE
        });
        const sameOwnerDifferentViewer = await makeApp(
            publicGetVenueBySlugRoute,
            IDS.touristFloor
        ).request('/case/slug/la-parrilla');
        expect(sameOwnerDifferentViewer.status).toBe(200);
        const otherViewerData = (await sameOwnerDifferentViewer.json()).data;
        expect(otherViewerData.menuFileUrl).toBe(data.menuFileUrl);
        expect(otherViewerData.menuSections).toEqual(data.menuSections);
        mocks.venueGetBySlug.mockResolvedValue({
            data: { ...VENUE, ownerId: IDS.gastroBasic },
            error: undefined
        });
        const basicResponse = await makeApp(publicGetVenueBySlugRoute, IDS.touristVip).request(
            '/case/slug/la-parrilla'
        );
        expect(basicResponse.status).toBe(200);
        const basicData = (await basicResponse.json()).data;
        expect(basicData.menuFileUrl).toBeNull();
        expect(basicData.menuSections).toBeUndefined();
        expect(basicData.venueEvents).toBeUndefined();
        expect(basicData.dailySpecials).toBeUndefined();
    });
});
