/**
 * HOS-2270: the owner's promotion routes of a venue.
 *
 * Mounts the real routes over the real listing-access pipeline (resolver, section
 * catalog, key and limit steps) and replaces only what is I/O: the ports (venue
 * facts, coverage, effective set), the promotion model counters and the service.
 * That makes the gate itself the thing under test: the entitlement, the limit, the
 * 404 for a foreign venue, and what a downgraded owner may still do.
 */
import {
    PermissionEnum,
    PublicationStatusEnum,
    ServiceErrorCode,
    type VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const STRANGER_ID = '99999999-9999-4999-8999-999999999999';
const VENUE_ID = '22222222-2222-4222-8222-222222222222';
const PROMOTION_ID = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    countActiveForVenueOwner: vi.fn(),
    findOneOfVenue: vi.fn()
}));
/** What every venue plan grants: the key the EDIT operation itself needs. */
const BASE_KEYS = ['edit_venue_info'];
let keys: string[] = [...BASE_KEYS, 'create_promotions'];
let maxActive = 5;
let venueOwnerId = OWNER_ID;

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        VenuePromotionService: class {
            list = mocks.list;
            create = mocks.create;
            update = mocks.update;
            softDelete = mocks.softDelete;
        }
    };
});

vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        ownerPromotionModel: {
            countActiveForVenueOwner: mocks.countActiveForVenueOwner,
            findOneOfVenue: mocks.findOneOfVenue
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: {
                ownerId: venueOwnerId,
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                businessLines: ['food']
            },
            ownerId: venueOwnerId
        }),
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [
                    ...keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const })),
                    { key: 'max_active_promotions', value: maxActive, strategy: 'MAX' as const }
                ]
            })
    })
}));

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedListVenuePromotionsRoute } = await import(
    '../../../../src/routes/venue/protected/listPromotions.js'
);
const { protectedCreateVenuePromotionRoute } = await import(
    '../../../../src/routes/venue/protected/createPromotion.js'
);
const { protectedPutVenuePromotionRoute } = await import(
    '../../../../src/routes/venue/protected/putPromotion.js'
);
const { protectedPatchVenuePromotionRoute } = await import(
    '../../../../src/routes/venue/protected/patchPromotion.js'
);
const { protectedDeleteVenuePromotionRoute } = await import(
    '../../../../src/routes/venue/protected/deletePromotion.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');

/** The six own-scoped permissions a `VENUE_OWNER` holds (HOS-2270). */
const VENUE_OWNER_PERMISSIONS = [
    PermissionEnum.OWNER_PROMOTION_CREATE,
    PermissionEnum.OWNER_PROMOTION_VIEW_OWN,
    PermissionEnum.OWNER_PROMOTION_UPDATE_OWN,
    PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN,
    PermissionEnum.OWNER_PROMOTION_RESTORE_OWN,
    PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN
];

function buildApp(args: { actorId?: string; permissions?: readonly PermissionEnum[] } = {}) {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((context, next) => {
        context.set('actor', {
            id: args.actorId ?? OWNER_ID,
            roles: [],
            permissions: args.permissions ?? VENUE_OWNER_PERMISSIONS
        } as never);
        return next();
    });
    for (const route of [
        protectedListVenuePromotionsRoute,
        protectedCreateVenuePromotionRoute,
        protectedPutVenuePromotionRoute,
        protectedPatchVenuePromotionRoute,
        protectedDeleteVenuePromotionRoute
    ]) {
        app.route('/', route);
    }
    return app;
}

const json = { 'content-type': 'application/json' };
const validBody = {
    title: '20% en cena',
    discountType: 'percentage',
    discountValue: 20,
    validFrom: '2026-12-01T00:00:00.000Z'
};
const promotionRow = {
    id: PROMOTION_ID,
    slug: 'promo',
    ownerId: OWNER_ID,
    entityType: 'venue',
    entityId: VENUE_ID,
    title: '20% en cena',
    description: null,
    discountType: 'percentage',
    discountValue: 20,
    lifecycleState: 'ACTIVE',
    touristAudience: 'plus',
    validFrom: '2026-12-01T00:00:00.000Z',
    validUntil: null,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z'
};

const post = (app: ReturnType<typeof buildApp>, body: unknown = validBody) =>
    app.request(`/${VENUE_ID}/promotions`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify(body)
    });
const patch = (app: ReturnType<typeof buildApp>, body: unknown) =>
    app.request(`/${VENUE_ID}/promotions/${PROMOTION_ID}`, {
        method: 'PATCH',
        headers: json,
        body: JSON.stringify(body)
    });
const put = (app: ReturnType<typeof buildApp>, body: unknown) =>
    app.request(`/${VENUE_ID}/promotions/${PROMOTION_ID}`, {
        method: 'PUT',
        headers: json,
        body: JSON.stringify(body)
    });
const del = (app: ReturnType<typeof buildApp>) =>
    app.request(`/${VENUE_ID}/promotions/${PROMOTION_ID}`, { method: 'DELETE' });
const get = (app: ReturnType<typeof buildApp>) => app.request(`/${VENUE_ID}/promotions`);

beforeEach(() => {
    vi.clearAllMocks();
    keys = [...BASE_KEYS, 'create_promotions'];
    maxActive = 5;
    venueOwnerId = OWNER_ID;
    mocks.list.mockResolvedValue({ data: { items: [promotionRow], activeCount: 1 } });
    mocks.create.mockResolvedValue({ data: promotionRow });
    mocks.update.mockResolvedValue({ data: promotionRow });
    mocks.softDelete.mockResolvedValue({ data: { count: 1 } });
    mocks.countActiveForVenueOwner.mockResolvedValue(2);
    mocks.findOneOfVenue.mockResolvedValue({
        id: PROMOTION_ID,
        entityType: 'venue',
        lifecycleState: 'ACTIVE',
        validUntil: null
    });
});

describe('AC-1 create', () => {
    it('creates through the service with the venue from the path, never an owner or target from the body', async () => {
        const response = await post(buildApp());

        expect(response.status).toBeLessThan(300);
        expect(mocks.create).toHaveBeenCalledTimes(1);
        const call = mocks.create.mock.calls[0]?.[0];
        expect(call.venueId).toBe(VENUE_ID);
        expect(call.actor.id).toBe(OWNER_ID);
        expect(call.request).not.toHaveProperty('ownerId');
        expect(call.request).not.toHaveProperty('entityId');
    });
});

describe('AC-2 entitlement', () => {
    it('403 ENTITLEMENT_REQUIRED for create_promotions without the key', async () => {
        keys = [...BASE_KEYS];

        const response = await post(buildApp());
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toMatchObject({
            code: 'ENTITLEMENT_REQUIRED',
            details: { entitlementKey: 'create_promotions' }
        });
        expect(mocks.create).not.toHaveBeenCalled();
    });
});

describe('AC-3 and AC-4 limit', () => {
    it('AC-3: 403 LIMIT_REACHED with the counters when the owner holds the maximum', async () => {
        maxActive = 5;
        mocks.countActiveForVenueOwner.mockResolvedValue(5);

        const response = await post(buildApp());
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toMatchObject({
            code: 'LIMIT_REACHED',
            details: { limitKey: 'max_active_promotions', currentCount: 5, maxAllowed: 5 }
        });
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('AC-4: the quota is the VENUE promotions only, so another vertical never spends it', async () => {
        mocks.countActiveForVenueOwner.mockResolvedValue(2);

        const response = await post(buildApp());

        expect(response.status).toBeLessThan(300);
        // The only counter the venue gate reads is the venue-owner one: it filters
        // entity_type = 'venue' in SQL, so accommodation promotions are never in it.
        expect(mocks.countActiveForVenueOwner).toHaveBeenCalledWith({ ownerId: OWNER_ID });
    });
});

describe('AC-5 body shape', () => {
    it.each([
        ['minNights', { minNights: 2 }],
        ['accommodationId', { accommodationId: '44444444-4444-4444-8444-444444444444' }],
        ['maxRedemptions', { maxRedemptions: 3 }]
    ])('400 VALIDATION_ERROR when the body carries %s', async (_name, extra) => {
        const response = await post(buildApp(), { ...validBody, ...extra });
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(mocks.create).not.toHaveBeenCalled();
    });
});

describe('AC-6 downgrade: what the owner loaded keeps running, only new work is frozen', () => {
    beforeEach(() => {
        keys = [...BASE_KEYS];
        maxActive = 0;
    });

    it('lists, pauses and deletes without the key', async () => {
        const app = buildApp();

        const listed = await get(app);
        const paused = await patch(app, { lifecycleState: 'ARCHIVED' });
        const deleted = await del(app);

        expect(listed.status).toBe(200);
        expect(paused.status).toBe(200);
        expect(deleted.status).toBe(200);
        expect(mocks.softDelete).toHaveBeenCalledTimes(1);
    });

    it('freezes create, edit and re-activate with ENTITLEMENT_REQUIRED', async () => {
        const app = buildApp();

        const created = await post(app);
        const edited = await put(app, { title: 'otra' });
        const reactivated = await patch(app, { lifecycleState: 'ACTIVE' });

        for (const response of [created, edited, reactivated]) {
            expect(response.status).toBe(403);
            expect((await response.json()).error.code).toBe('ENTITLEMENT_REQUIRED');
        }
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('an owner over the new, lower cap can still pause but not edit what stays active', async () => {
        keys = [...BASE_KEYS, 'create_promotions'];
        maxActive = 1;
        mocks.countActiveForVenueOwner.mockResolvedValue(3);
        const app = buildApp();

        const paused = await patch(app, { lifecycleState: 'DRAFT' });
        const edited = await put(app, { title: 'otra' });

        expect(paused.status).toBe(200);
        expect(edited.status).toBe(403);
        expect((await edited.json()).error.code).toBe('LIMIT_REACHED');
    });

    it('re-activating a paused promotion asks for one more slot', async () => {
        keys = [...BASE_KEYS, 'create_promotions'];
        maxActive = 3;
        mocks.countActiveForVenueOwner.mockResolvedValue(3);
        mocks.findOneOfVenue.mockResolvedValue({
            id: PROMOTION_ID,
            entityType: 'venue',
            lifecycleState: 'ARCHIVED',
            validUntil: null
        });

        const response = await patch(buildApp(), { lifecycleState: 'ACTIVE' });
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toMatchObject({
            code: 'LIMIT_REACHED',
            details: { currentCount: 3, maxAllowed: 3 }
        });
    });
});

describe('AC-7 a venue that is not the owner', () => {
    it('answers 404, never 403, on every route', async () => {
        venueOwnerId = STRANGER_ID;
        const app = buildApp();

        const responses = await Promise.all([
            get(app),
            post(app),
            put(app, { title: 'x' }),
            patch(app, { lifecycleState: 'ARCHIVED' }),
            del(app)
        ]);

        for (const response of responses) expect(response.status).toBe(404);
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.softDelete).not.toHaveBeenCalled();
    });
});

describe('AC-14 roles are permissions only', () => {
    it('a VENUE_OWNER (the six own-scoped permissions) is not refused by permission', async () => {
        keys = [...BASE_KEYS];

        const response = await post(buildApp());

        // The refusal is the plan gate, not FORBIDDEN.
        expect((await response.json()).error.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('an actor without the permission is refused by it', async () => {
        const response = await post(buildApp({ permissions: [] }));

        expect(response.status).toBe(403);
        expect((await response.json()).error.code).not.toBe('ENTITLEMENT_REQUIRED');
    });
});

describe('list', () => {
    it('answers the items with the quota counters, and the effective cap', async () => {
        maxActive = 7;

        const response = await get(buildApp());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.meta).toEqual({ activeCount: 1, maxActive: 7 });
        expect(body.data.items).toHaveLength(1);
    });

    it('surfaces a service refusal with its own status', async () => {
        mocks.list.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'nope' }
        });

        const response = await get(buildApp());

        expect(response.status).toBe(404);
    });
});
