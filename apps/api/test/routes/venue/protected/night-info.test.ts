/**
 * HOS-1846 (TEST:4.2:2 AC:4:3, TEST:4.2:3 AC:4:6, TEST:4.2:4 AC:4:7).
 *
 * Exercises the REAL protected PATCH route end to end: real
 * `enforceListingAccess` chain (with the ports mocked, as every route test
 * does), real `VenueService` write pipeline, and an in-memory model double
 * that persists the merged update so a second request can read the value back.
 *
 * The section belongs to the `nightlife` business line (step 4b), so a body
 * that writes `nightInfo` on a `food`-only listing is 409 for its owner and
 * 404 for a third party.
 */
import { PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppOpenAPI } from '../../../../src/types.js';

delete process.env.CI;
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_API_DEBUG_ERRORS = 'true';

const BASE = '/api/v1/protected/venues';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const VENUE_ID = '33333333-3333-4333-8333-333333333333';
const DEST_ID = '44444444-4444-4444-8444-444444444444';

interface StoreRow extends Record<string, unknown> {
    id: string;
    ownerId: string;
    type: string;
    businessLines: string[];
    publicationStatus: string;
    entryKind: string | null;
    entryPriceFrom: number | null;
    entryPriceUpdatedAt: Date | null;
}

const { fakeModel, store } = vi.hoisted(() => {
    const state = {
        row: {
            id: '33333333-3333-4333-8333-333333333333',
            slug: 'night-venue',
            name: 'Night Venue',
            summary: 'A night venue summary.',
            description: 'A detailed description of this night venue for visitors.',
            type: 'BOLICHE',
            businessLines: ['nightlife'],
            ownerId: '11111111-1111-4111-8111-111111111111',
            destinationId: '44444444-4444-4444-8444-444444444444',
            publicationStatus: 'DRAFT',
            featuredByEntitlement: false,
            media: null,
            videos: [],
            averageRating: 0,
            reviewsCount: 0,
            rating: null,
            seo: null,
            tags: [],
            priceRange: null,
            menuUrl: null,
            menuFileUrl: null,
            menuFileKind: null,
            openingHours: null,
            contactInfo: null,
            socialNetworks: null,
            faqs: [],
            nameI18n: null,
            summaryI18n: null,
            descriptionI18n: null,
            richDescriptionI18n: null,
            entryKind: null,
            entryNoteI18n: null,
            entryPriceFrom: null,
            entryPriceUpdatedAt: null,
            policies: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
            createdById: null,
            updatedById: null
        } as Record<string, unknown>
    };
    return {
        store: state,
        fakeModel: {
            findById: vi.fn(async () => ({ ...state.row })),
            findOne: vi.fn(async () => null),
            update: vi.fn(async (_where: unknown, data: Record<string, unknown>) => {
                state.row = { ...state.row, ...data };
                return { ...state.row };
            }),
            create: vi.fn(async () => ({ ...state.row })),
            findByIds: vi.fn(async () => [{ ...state.row }])
        }
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        withTransaction: async (
            callback: (tx: { execute: () => Promise<void> }) => Promise<unknown>
        ) => callback({ execute: async () => undefined })
    };
});

vi.mock(
    '../../../../../../packages/service-core/src/services/listing/listing-owner-act.js',
    async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import('../../../../../../packages/service-core/src/services/listing/listing-owner-act.js')
            >();
        return { ...actual, recordListingOwnerAct: vi.fn(async () => undefined) };
    }
);

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        VenueService: class InMemoryVenueService extends orig.VenueService {
            constructor(...args: ConstructorParameters<typeof orig.VenueService>) {
                super(...args);
                Object.defineProperty(this, 'model', { value: fakeModel });
            }
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: {
                ownerId: store.row.ownerId,
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                businessLines: store.row.businessLines
            },
            ownerId: store.row.ownerId
        }),
        billing: { coverage: async () => ({ covered: true, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'edit_venue_info', value: 1, strategy: 'MAX' }]
            }),
        preTrialDraftLimits: async () => ({})
    })
}));

function headers(actorId: string, permissions: string[] = []): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': 'VENUE_OWNER',
        'x-mock-actor-permissions': JSON.stringify(permissions),
        authorization: 'Bearer valid-test-token'
    };
}

const ownerHeaders = () => headers(OWNER_ID, ['venue.editOwn']);
const otherHeaders = () => headers(OTHER_ID, []);

function resetStore(overrides: Partial<StoreRow> = {}): void {
    store.row = {
        ...store.row,
        id: VENUE_ID,
        ownerId: OWNER_ID,
        type: 'BOLICHE',
        businessLines: ['nightlife'],
        publicationStatus: PublicationStatusEnum.DRAFT,
        entryKind: null,
        entryNoteI18n: null,
        entryPriceFrom: null,
        entryPriceUpdatedAt: null,
        policies: null,
        ...overrides
    };
}

describe('nightInfo over the protected venue routes (HOS-1846)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        const { initApp } = await import('../../../../src/app.js');
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
    });

    const patch = (body: unknown, actorHeaders = ownerHeaders()) =>
        app.request(`${BASE}/${VENUE_ID}`, {
            method: 'PATCH',
            headers: actorHeaders,
            body: JSON.stringify(body)
        });

    // -----------------------------------------------------------------------
    // TEST:4.2:2 (AC:4:3) — section presence through step 4b
    // -----------------------------------------------------------------------

    it('returns 409 SECTION_ABSENT to the owner writing nightInfo on a food listing', async () => {
        resetStore({ type: 'RESTAURANT', businessLines: ['food'] });
        const response = await patch({ policies: { minAge: 20 } });
        expect(response.status, await response.clone().text()).toBe(409);
        expect((await response.json()).error).toMatchObject({
            details: { reason: 'SECTION_ABSENT', section: 'nightInfo' }
        });
    });

    it('returns 404 to a third party writing nightInfo on a foreign listing', async () => {
        resetStore({ type: 'RESTAURANT', businessLines: ['food'] });
        const response = await patch({ policies: { minAge: 20 } }, otherHeaders());
        expect(response.status, await response.clone().text()).toBe(404);
    });

    it('accepts adding nightlife and its data in the same PATCH and persists it', async () => {
        resetStore({ type: 'RESTAURANT', businessLines: ['food'] });
        const response = await patch({ businessLines: ['food', 'nightlife'], entryKind: 'free' });
        expect(response.status, await response.clone().text()).toBe(200);

        // Read it back from the model store with a second, empty PATCH: the 2xx
        // above proves nothing on its own.
        const readBack = await patch({});
        expect(readBack.status, await readBack.clone().text()).toBe(200);
        expect((await readBack.json()).data.entryKind).toBe('free');
        expect(store.row.businessLines).toEqual(['food', 'nightlife']);
    });

    it('returns 409 when the PATCH removes nightlife and still writes nightInfo', async () => {
        resetStore({ type: 'RESTAURANT', businessLines: ['food', 'nightlife'] });
        const response = await patch({ businessLines: ['food'], entryKind: 'free' });
        expect(response.status, await response.clone().text()).toBe(409);
        expect((await response.json()).error.details.reason).toBe('SECTION_ABSENT');
    });

    it('returns 409 when a HELADERIA is created with nightInfo fields', async () => {
        const response = await app.request(BASE, {
            method: 'POST',
            headers: ownerHeaders(),
            body: JSON.stringify({
                name: 'Heladeria Nocturna',
                summary: 'A valid summary for the ice-cream shop.',
                description: 'A sufficiently detailed description for this listing.',
                type: 'HELADERIA',
                destinationId: DEST_ID,
                policies: { dressCode: 'casual' }
            })
        });
        expect(response.status, await response.clone().text()).toBe(409);
        expect((await response.json()).error).toMatchObject({
            details: { reason: 'SECTION_ABSENT', section: 'nightInfo' }
        });
    });

    // -----------------------------------------------------------------------
    // TEST:4.2:3 (AC:4:6) — minAge bounds
    // -----------------------------------------------------------------------

    it.each([12, 31])('rejects minAge %i with 400', async (minAge) => {
        const response = await patch({ policies: { minAge } });
        expect(response.status, await response.clone().text()).toBe(400);
    });

    it.each([13, 30])('accepts minAge %i', async (minAge) => {
        const response = await patch({ policies: { minAge } });
        expect(response.status, await response.clone().text()).toBe(200);
        expect((store.row.policies as Record<string, unknown> | null)?.minAge).toBe(minAge);
    });

    it('documents that an invalid shape for a third party fails validation first (400)', async () => {
        resetStore({ type: 'RESTAURANT', businessLines: ['food'] });
        const response = await patch({ policies: { minAge: 12 } }, otherHeaders());
        expect(response.status).toBe(400);
    });

    // -----------------------------------------------------------------------
    // TEST:4.2:4 (AC:4:7) — price freshness over HTTP
    // -----------------------------------------------------------------------

    it('does not move entryPriceUpdatedAt when the same price is re-sent', async () => {
        const storedDate = new Date('2026-01-01T00:00:00.000Z');
        resetStore({ entryKind: 'paid', entryPriceFrom: 5000, entryPriceUpdatedAt: storedDate });
        const response = await patch({ entryPriceFrom: 5000 });
        expect(response.status, await response.clone().text()).toBe(200);

        const payload = fakeModel.update.mock.calls.at(-1)?.[1] as Record<string, unknown>;
        expect(payload).not.toHaveProperty('entryPriceUpdatedAt');
        expect(store.row.entryPriceUpdatedAt).toEqual(storedDate);
    });

    it('moves entryPriceUpdatedAt when the price changes', async () => {
        resetStore({
            entryKind: 'paid',
            entryPriceFrom: 5000,
            entryPriceUpdatedAt: new Date('2026-01-01T00:00:00.000Z')
        });
        const before = Date.now();
        const response = await patch({ entryPriceFrom: 7000 });
        expect(response.status, await response.clone().text()).toBe(200);

        const payload = fakeModel.update.mock.calls.at(-1)?.[1] as Record<string, unknown>;
        expect(payload.entryPriceUpdatedAt).toBeInstanceOf(Date);
        expect((payload.entryPriceUpdatedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
        expect(store.row.entryPriceFrom).toBe(7000);
    });

    it('clears price and date when the entry switches to free', async () => {
        resetStore({
            entryKind: 'paid',
            entryPriceFrom: 5000,
            entryPriceUpdatedAt: new Date('2026-01-01T00:00:00.000Z')
        });
        const response = await patch({ entryKind: 'free' });
        expect(response.status, await response.clone().text()).toBe(200);
        expect(store.row.entryPriceFrom).toBeNull();
        expect(store.row.entryPriceUpdatedAt).toBeNull();
    });

    it('clears price and date when entryKind is nulled explicitly', async () => {
        resetStore({
            entryKind: 'paid',
            entryPriceFrom: 5000,
            entryPriceUpdatedAt: new Date('2026-01-01T00:00:00.000Z')
        });
        const response = await patch({ entryKind: null });
        expect(response.status, await response.clone().text()).toBe(200);
        expect(store.row.entryKind).toBeNull();
        expect(store.row.entryPriceFrom).toBeNull();
        expect(store.row.entryPriceUpdatedAt).toBeNull();
    });

    it('rejects a price with entryKind varies with 400 VALIDATION_ERROR', async () => {
        resetStore({ entryKind: 'paid', entryPriceFrom: 5000 });
        const response = await patch({ entryKind: 'varies', entryPriceFrom: 1000 });
        expect(response.status, await response.clone().text()).toBe(400);
        expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
    });
});
