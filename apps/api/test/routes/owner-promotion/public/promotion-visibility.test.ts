/**
 * HOS-2589: the per-actor promotion reads (`/public/owner-promotions/visible` and
 * `/listing`), the reshaped `exclusive-deals` alias, and the guest policy of the
 * legacy full-content reads.
 *
 * Mounts the real routes over a bare Hono app and replaces only I/O: the promotion
 * models, the floor-plan read and the effective set. The free quota is a fixture
 * value standing for the catalog row, never a source literal.
 *
 * Covers AC-5, AC-8, AC-10, AC-11, AC-12, AC-22, AC-24, AC-29, AC-31.
 */
import {
    OwnerPromotionDiscountTypeEnum,
    OwnerPromotionEntityTypeEnum,
    type VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

/** Stands for the TOURIST floor plan's `max_free_visible_promotions` row. */
const FREE_QUOTA = 3;
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const VENUE_ID = '33333333-3333-4333-8333-333333333333';
const ACCOMMODATION_ID = '44444444-4444-4444-8444-444444444444';
const REAL_NAME = 'Parrilla Don Secreto';

const mocks = vi.hoisted(() => ({
    findPublicPlaces: vi.fn(),
    findActiveForVenueAllAudiences: vi.fn(),
    findActiveListingPage: vi.fn(),
    findActiveForAccommodation: vi.fn(),
    findActiveForVenue: vi.fn(),
    accommodationFindById: vi.fn(),
    floorLimit: vi.fn(),
    effectiveSetFails: { value: false },
    entries: { value: [] as Array<{ key: string; value: number }> }
}));

// The global setup swaps `ServiceError` for a mock class; the error handler checks
// the real one, so the routes must throw the real one.
vi.mock('@repo/service-core', async (importActual) => importActual());

vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    const chain = {
        select: () => chain,
        from: () => chain,
        where: () => chain,
        limit: async () => [{ id: 'floor-plan' }]
    };
    return {
        ...actual,
        getDb: () => chain,
        plans: { id: 'id', vertical: 'vertical', role: 'role' },
        planCatalogModel: {
            findCurrentPlanVersion: async () => ({ id: 'floor-version' }),
            findPlanVersionEffects: async () => ({
                entitlements: [],
                limits: [{ key: 'max_free_visible_promotions', value: mocks.floorLimit() }]
            })
        },
        accommodationModel: { findById: mocks.accommodationFindById },
        ownerPromotionModel: {
            findActiveForAccommodation: mocks.findActiveForAccommodation,
            findActiveForVenue: mocks.findActiveForVenue
        },
        ownerPromotionTouristModel: {
            findPublicPlaces: mocks.findPublicPlaces,
            findActiveForVenueAllAudiences: mocks.findActiveForVenueAllAudiences,
            findActiveListingPage: mocks.findActiveListingPage
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) => {
            if (mocks.effectiveSetFails.value) throw new Error('effective set down');
            return rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: mocks.entries.value.map((entry) => ({
                    ...entry,
                    strategy: 'MAX' as const
                }))
            });
        }
    })
}));

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { publicVisibleOwnerPromotionsRoute } = await import(
    '../../../../src/routes/owner-promotion/public/visible.js'
);
const { publicListingOwnerPromotionsRoute } = await import(
    '../../../../src/routes/owner-promotion/public/listing.js'
);
const { protectedListExclusiveDealsRoute } = await import(
    '../../../../src/routes/owner-promotion/protected/exclusive-deals.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');
const { createGuestActor } = await import('../../../../src/utils/actor.js');
const { PUBLIC_CACHE_ENDPOINTS, PRIVATE_CACHE_ENDPOINTS } = await import(
    '../../../../src/middlewares/cache.constants.js'
);

type Reader = 'guest' | 'free' | 'vip';

function buildApp(reader: Reader) {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((context, next) => {
        context.set(
            'actor',
            reader === 'guest'
                ? createGuestActor()
                : ({ id: USER_ID, roles: [], permissions: [] } as never)
        );
        return next();
    });
    for (const route of [
        publicVisibleOwnerPromotionsRoute,
        publicListingOwnerPromotionsRoute,
        protectedListExclusiveDealsRoute
    ]) {
        app.route('/', route);
    }
    return app;
}

let counter = 0;
function promotion(audience: 'plus' | 'vip') {
    counter += 1;
    const n = String(counter).padStart(12, '0');
    return {
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${n}`,
        slug: `secret-slug-${counter}`,
        ownerId: OWNER_ID,
        accommodationId: null,
        entityType: OwnerPromotionEntityTypeEnum.VENUE,
        entityId: VENUE_ID,
        title: `Secret title ${counter}`,
        description: `Secret condition ${counter}`,
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 10 + counter,
        minNights: null,
        validFrom: new Date('2026-11-01T00:00:00Z'),
        validUntil: new Date('2027-03-15T00:00:00Z'),
        windowWeekdays: null,
        windowStart: null,
        windowEnd: null,
        maxRedemptions: null,
        currentRedemptions: 0,
        lifecycleState: 'ACTIVE',
        touristAudience: audience,
        firstActivatedAt: null,
        vipPausedAt: null,
        createdAt: new Date('2026-11-01T00:00:00Z'),
        updatedAt: new Date('2026-11-01T00:00:00Z'),
        deletedAt: null
    };
}

/** «Page P»: 5 `plus` and 2 `vip`. */
let PAGE_P: ReturnType<typeof promotion>[] = [];
const venuePlaces = () => ({
    accommodations: new Map(),
    venues: new Map([[VENUE_ID, { id: VENUE_ID, slug: 'parrilla-secreta', name: REAL_NAME }]])
});

function setReader(reader: Reader): void {
    mocks.entries.value =
        reader === 'vip'
            ? [{ key: 'vip_promotions_access', value: 1 }]
            : [{ key: 'max_free_visible_promotions', value: FREE_QUOTA }];
}

const visibleUrl = (seed = 'seed-abcdef12') =>
    `/visible?entityType=venue&entityId=${VENUE_ID}&seed=${seed}`;

beforeEach(() => {
    vi.clearAllMocks();
    PAGE_P = [
        ...Array.from({ length: 5 }, () => promotion('plus')),
        ...Array.from({ length: 2 }, () => promotion('vip'))
    ];
    mocks.effectiveSetFails.value = false;
    mocks.floorLimit.mockReturnValue(FREE_QUOTA);
    mocks.findPublicPlaces.mockImplementation(async () => venuePlaces());
    mocks.findActiveForVenueAllAudiences.mockImplementation(async () => PAGE_P);
    mocks.findActiveListingPage.mockImplementation(async () => ({ items: PAGE_P, total: 7 }));
});

type Item = { kind: 'visible' | 'locked'; audience: string } & Record<string, unknown>;

async function readItems(response: Response): Promise<Item[]> {
    const body = (await response.json()) as { data: { items: Item[] } };
    return body.data.items;
}

describe('GET /visible', () => {
    it.each<Reader>([
        'free',
        'guest'
    ])('AC-5: a %s reader gets exactly the quota visible, all plus, the rest locked', async (reader) => {
        setReader(reader);
        const response = await buildApp(reader).request(visibleUrl());

        expect(response.status).toBe(200);
        const items = await readItems(response);
        const visible = items.filter((item) => item.kind === 'visible');
        const locked = items.filter((item) => item.kind === 'locked');
        expect(visible).toHaveLength(FREE_QUOTA);
        expect(visible.every((item) => item.audience === 'plus')).toBe(true);
        expect(locked).toHaveLength(4);
        expect(locked.filter((item) => item.audience === 'vip')).toHaveLength(2);
    });

    it('AC-8/AC-29: the serialized locked items carry none of the hidden values', async () => {
        setReader('guest');
        const response = await buildApp('guest').request(visibleUrl());
        const items = await readItems(response);
        const visibleIds = new Set(items.filter((i) => i.kind === 'visible').map((i) => i.id));
        const lockedJson = JSON.stringify(items.filter((item) => item.kind === 'locked'));

        expect(lockedJson).not.toContain(REAL_NAME);
        expect(lockedJson).not.toContain('parrilla-secreta');
        expect(lockedJson).not.toContain(VENUE_ID);
        expect(lockedJson).not.toContain(OWNER_ID);
        expect(lockedJson).not.toContain('2027-03-15');
        for (const hidden of PAGE_P.filter((row) => !visibleIds.has(row.id))) {
            expect(lockedJson).not.toContain(hidden.id);
            expect(lockedJson).not.toContain(hidden.slug);
            expect(lockedJson).not.toContain(hidden.title);
            expect(lockedJson).not.toContain(hidden.description);
        }
        for (const item of items.filter((i) => i.kind === 'locked')) {
            const name = item.placeholderName as string;
            expect(Math.abs(name.length - REAL_NAME.length)).toBeLessThanOrEqual(1);
            expect(name).not.toBe(REAL_NAME);
        }
    });

    it('AC-12: a VIP reader gets all seven visible', async () => {
        setReader('vip');
        const items = await readItems(await buildApp('vip').request(visibleUrl()));
        expect(items).toHaveLength(7);
        expect(items.every((item) => item.kind === 'visible')).toBe(true);
    });

    it('AC-11: a failed effective-set read locks everything', async () => {
        mocks.effectiveSetFails.value = true;
        const items = await readItems(await buildApp('free').request(visibleUrl()));
        expect(items.every((item) => item.kind === 'locked')).toBe(true);
    });

    it('the quota follows the catalog value, not a constant', async () => {
        mocks.floorLimit.mockReturnValue(1);
        const items = await readItems(await buildApp('guest').request(visibleUrl()));
        expect(items.filter((item) => item.kind === 'visible')).toHaveLength(1);
    });

    it('AC-6/AC-30: the same seed gives the same pick', async () => {
        setReader('guest');
        const ids = async () =>
            (await readItems(await buildApp('guest').request(visibleUrl('stable-seed-1'))))
                .filter((item) => item.kind === 'visible')
                .map((item) => item.id);
        expect(await ids()).toEqual(await ids());
    });

    it('AC-22: answers Cache-Control private, no-store and Vary Cookie', async () => {
        const response = await buildApp('guest').request(visibleUrl());
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(response.headers.get('vary')).toContain('Cookie');
        const path = '/api/v1/public/owner-promotions/visible';
        expect(PUBLIC_CACHE_ENDPOINTS.some((prefix) => path.startsWith(prefix))).toBe(false);
        expect(PRIVATE_CACHE_ENDPOINTS.some((prefix) => path.startsWith(prefix))).toBe(false);
    });

    it('a malformed seed still answers (a fresh pick)', async () => {
        const response = await buildApp('guest').request(visibleUrl('<script>'));
        expect(response.status).toBe(200);
    });

    it('404 for a place that is not published', async () => {
        mocks.findPublicPlaces.mockResolvedValue({ accommodations: new Map(), venues: new Map() });
        const response = await buildApp('guest').request(visibleUrl());
        expect(response.status).toBe(404);
        expect(mocks.findActiveForVenueAllAudiences).not.toHaveBeenCalled();
    });

    it('an accommodation page also lists the owner-wide promotions, placed on it', async () => {
        setReader('vip');
        mocks.findPublicPlaces.mockResolvedValue({
            accommodations: new Map([
                [ACCOMMODATION_ID, { id: ACCOMMODATION_ID, slug: 'cabana', name: 'Cabaña' }]
            ]),
            venues: new Map()
        });
        mocks.accommodationFindById.mockResolvedValue({ id: ACCOMMODATION_ID, ownerId: OWNER_ID });
        const ownerWide = {
            ...promotion('plus'),
            entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION,
            entityId: null
        };
        mocks.findActiveForAccommodation.mockResolvedValue({ items: [ownerWide], total: 1 });

        const response = await buildApp('vip').request(
            `/visible?entityType=accommodation&entityId=${ACCOMMODATION_ID}`
        );
        const items = await readItems(response);

        expect(mocks.findActiveForAccommodation.mock.calls[0]?.[0]).toMatchObject({
            accommodationId: ACCOMMODATION_ID,
            ownerId: OWNER_ID,
            touristAudiences: ['plus', 'vip']
        });
        expect(items[0]).toMatchObject({ kind: 'visible', place: { id: ACCOMMODATION_ID } });
    });
});

describe('GET /listing (AC-31, D07)', () => {
    it.each([
        { reader: 'guest', visibleCount: 0, vipCount: 0, quota: 0 },
        { reader: 'free', visibleCount: FREE_QUOTA, vipCount: 0, quota: FREE_QUOTA },
        { reader: 'vip', visibleCount: 7, vipCount: 2, quota: 0 }
    ] as const)('returns $visibleCount visible promotions to a $reader reader', async ({
        reader,
        visibleCount,
        vipCount,
        quota
    }) => {
        setReader(reader);
        const response = await buildApp(reader).request(
            '/listing?page=1&pageSize=12&seed=seed-abcdef12'
        );
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            data: {
                items: Item[];
                pagination: { total: number; totalPages: number };
                meta: { isVip: boolean; freeQuota: number | null };
            };
        };
        const visible = body.data.items.filter((item) => item.kind === 'visible');
        expect(visible).toHaveLength(visibleCount);
        expect(visible.filter((item) => item.audience === 'vip')).toHaveLength(vipCount);
        expect(body.data.items.filter((item) => item.kind === 'locked')).toHaveLength(
            7 - visibleCount
        );
        expect(body.data.meta).toMatchObject({ isVip: reader === 'vip', freeQuota: quota });
        expect(body.data.pagination).toMatchObject({ total: 7, totalPages: 1 });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
    });
});

describe('GET /exclusive-deals (AC-24)', () => {
    it('a free tourist gets a visible | locked list, never a 403', async () => {
        setReader('free');
        const response = await buildApp('free').request('/exclusive-deals');
        expect(response.status).toBe(200);
        const items = await readItems(response);
        expect(items.filter((item) => item.kind === 'locked').length).toBeGreaterThan(0);
    });
});
