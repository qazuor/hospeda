/**
 * HOS-1874 (TEST:7.2:1 AC:7:2, TEST:7.2:4 AC:7:7).
 *
 * Exercises the REAL admin PATCH/PUT routes end to end: the real
 * `enforceListingAccess` chain (with the access ports mocked, as every route
 * test does) and the real `VenueService` write pipeline over an in-memory model
 * double. `enforceListingAccess` is deliberately NOT mocked, because the
 * section gate it applies is exactly what this leaf adds.
 *
 * Step 4b rejects a write of the nightlife section on a listing whose business
 * lines do not offer it, and step 6 rejects a paid section whose entitlement
 * key the owner lacks. The unit cases use an admin who OWNS the listing so the
 * write path stays in-memory; the foreign-owner case lives in the integration
 * suite (TEST:7.2:2), where the action-15 audit and email have a database.
 */
import { EntitlementKeyEnum, PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppOpenAPI } from '../../../../src/types.js';

delete process.env.CI;
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_API_DEBUG_ERRORS = 'true';

const BASE = '/api/v1/admin/venues';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const VENUE_ID = '33333333-3333-4333-8333-333333333333';

/** The Basic plan's only venue key: step 4b passes, step 6 gates the paid menu. */
const BASIC_VENUE_KEYS = [EntitlementKeyEnum.EDIT_VENUE_INFO] as const;
/** The support member's own Premium plan; the owner plan, not this, must decide. */
const PREMIUM_VENUE_KEYS = [
    EntitlementKeyEnum.EDIT_VENUE_INFO,
    EntitlementKeyEnum.MANAGE_VENUE_MENU,
    EntitlementKeyEnum.MENU_ITEM_PHOTOS,
    EntitlementKeyEnum.MULTILINGUAL_VENUE_MENU,
    EntitlementKeyEnum.MENU_QR_SCAN_METRICS,
    EntitlementKeyEnum.MANAGE_VENUE_DAILY_SPECIAL,
    EntitlementKeyEnum.MANAGE_VENUE_EVENTS
] as const;

function planKeysFor(userId: string): readonly string[] {
    return userId === OTHER_ID ? PREMIUM_VENUE_KEYS : BASIC_VENUE_KEYS;
}

const { fakeModel, store } = vi.hoisted(() => {
    const state = {
        row: {
            id: '33333333-3333-4333-8333-333333333333',
            ownerId: '11111111-1111-4111-8111-111111111111',
            type: 'RESTAURANT',
            businessLines: ['food'],
            publicationStatus: 'DRAFT',
            name: 'Saved venue',
            slug: 'saved-venue',
            summary: 'Una ficha de prueba.',
            description: 'Descripción detallada para la ficha de prueba.',
            destinationId: '44444444-4444-4444-8444-444444444444',
            nameI18n: null,
            summaryI18n: null,
            descriptionI18n: null,
            richDescriptionI18n: null,
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
            createdById: null,
            updatedById: null,
            deletedAt: null,
            deletedById: null,
            entryKind: null,
            entryNoteI18n: null,
            entryPriceFrom: null,
            entryPriceUpdatedAt: null,
            policies: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z')
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
        ) => callback({ execute: async () => undefined }),
        // HOS-2060: the policies merge reads the stored object under a row lock;
        // here the lock is the in-memory store.
        listingPoliciesModel: {
            readForUpdate: async () => ({
                found: true,
                policies:
                    (store.row as { policies?: Record<string, unknown> | null }).policies ?? null
            })
        }
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

/**
 * The owner's effective set carries the edit capability and NOT the paid menu
 * key, so a write of the menu section answers 403 after step 4b lets it through.
 */
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
        // The plan depends on WHO is evaluated: the owner is Basic, the support
        // member on the same request is Premium. Existing cases all evaluate the
        // owner, so they keep receiving exactly `edit_venue_info`.
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: planKeysFor(userId).map((key) => ({
                    key,
                    value: 1,
                    strategy: 'MAX'
                }))
            }),
        preTrialDraftLimits: async () => ({})
    })
}));

function headers(actorId: string, permissions: string[] = []): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(permissions),
        authorization: 'Bearer valid-test-token'
    };
}

const ownerAdminHeaders = () => headers(OWNER_ID, ['access.panelAdmin', 'venue.editAll']);

function resetStore(overrides: Record<string, unknown> = {}): void {
    store.row = {
        ...store.row,
        id: VENUE_ID,
        ownerId: OWNER_ID,
        type: 'RESTAURANT',
        businessLines: ['food'],
        publicationStatus: PublicationStatusEnum.DRAFT,
        name: 'Saved venue',
        priceRange: null,
        menuUrl: null,
        entryKind: null,
        entryNoteI18n: null,
        entryPriceFrom: null,
        entryPriceUpdatedAt: null,
        policies: null,
        ...overrides
    };
}

describe('Admin venue section gates (HOS-1874)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        const { initApp } = await import('../../../../src/app.js');
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
    });

    const patch = (body: unknown, actorHeaders = ownerAdminHeaders()) =>
        app.request(`${BASE}/${VENUE_ID}`, {
            method: 'PATCH',
            headers: actorHeaders,
            body: JSON.stringify(body)
        });

    const put = (body: unknown, actorHeaders = ownerAdminHeaders()) =>
        app.request(`${BASE}/${VENUE_ID}`, {
            method: 'PUT',
            headers: actorHeaders,
            body: JSON.stringify(body)
        });

    // -----------------------------------------------------------------------
    // TEST:7.2:1 (AC:7:2) — the admin PATCH/PUT inherit step 4b
    // -----------------------------------------------------------------------

    it('rejects a PATCH of nightlife fields on a food listing with 409', async () => {
        const response = await patch({ policies: { minAge: 20 } });

        expect(response.status, await response.clone().text()).toBe(409);
        expect((await response.json()).error).toMatchObject({
            details: { reason: 'SECTION_ABSENT', section: 'nightInfo' }
        });
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    it('rejects a PUT of nightlife fields on a food listing with 409', async () => {
        const response = await put({ policies: { minAge: 20 } });

        expect(response.status, await response.clone().text()).toBe(409);
        expect((await response.json()).error).toMatchObject({
            details: { reason: 'SECTION_ABSENT', section: 'nightInfo' }
        });
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    it('answers 403 before 4b when the foreign admin lacks action 15', async () => {
        store.row = { ...store.row, ownerId: OTHER_ID };
        const response = await patch(
            { policies: { minAge: 20 } },
            headers(OWNER_ID, ['access.panelAdmin', 'venue.editAll'])
        );

        expect(response.status, await response.clone().text()).toBe(403);
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    it('lets a common-section PATCH through (control)', async () => {
        const response = await patch({ name: 'Nuevo nombre' });

        expect(response.status, await response.clone().text()).toBe(200);
        expect(fakeModel.update).toHaveBeenCalledTimes(1);
    });

    it('lets a PATCH that also adds nightlife through (control)', async () => {
        const response = await patch({
            businessLines: ['food', 'nightlife'],
            policies: { minAge: 20 }
        });

        expect(response.status, await response.clone().text()).toBe(200);
        expect(fakeModel.update).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------------
    // TEST:7.2:4 (AC:7:7) — the admin save no longer carries the paid link
    // -----------------------------------------------------------------------

    it('saves what the menu-free form can send', async () => {
        resetStore({ type: 'CAFE', businessLines: ['food'] });
        const response = await patch({ name: 'Nuevo nombre', priceRange: 'MID' });

        expect(response.status, await response.clone().text()).toBe(200);
        const body = await response.json();
        expect(body.data.name).toBe('Nuevo nombre');
        expect(fakeModel.update).toHaveBeenCalledTimes(1);
    });

    it('answers 403 ENTITLEMENT_REQUIRED for the paid menu link on a food listing', async () => {
        resetStore({ type: 'CAFE', businessLines: ['food'] });
        const response = await patch({ menuUrl: 'https://example.com/carta' });

        expect(response.status, await response.clone().text()).toBe(403);
        expect((await response.json()).error).toMatchObject({
            code: 'ENTITLEMENT_REQUIRED',
            details: { entitlementKey: 'manage_venue_menu' }
        });
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    it('answers 409 SECTION_ABSENT for the menu link on a nightlife-only listing', async () => {
        resetStore({ type: 'BOLICHE', businessLines: ['nightlife'] });
        const response = await patch({ menuUrl: 'https://example.com/carta' });

        expect(response.status, await response.clone().text()).toBe(409);
        expect((await response.json()).error).toMatchObject({
            details: { reason: 'SECTION_ABSENT', section: 'menu' }
        });
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // TEST:7.4:3 (AC:7:5) — the support write is gated on the OWNER's plan,
    // never on the support member's own Premium plan.
    // -----------------------------------------------------------------------

    describe('TEST:7.4:3 AC:7:5 support writes follow the owner plan', () => {
        const supportHeaders = () =>
            headers(OTHER_ID, ['access.panelAdmin', 'listing.foreignContent.edit']);

        it('answers 403 ENTITLEMENT_REQUIRED for the paid menu link the owner lacks', async () => {
            resetStore({ type: 'CAFE', businessLines: ['food'] });

            const response = await patch(
                { menuUrl: 'https://example.com/carta' },
                supportHeaders()
            );

            expect(response.status, await response.clone().text()).toBe(403);
            expect((await response.json()).error).toMatchObject({
                code: 'ENTITLEMENT_REQUIRED',
                details: { entitlementKey: 'manage_venue_menu' }
            });
            expect(fakeModel.update).not.toHaveBeenCalled();
        });

        it('control: the owner gets the same 403 for the same body', async () => {
            resetStore({ type: 'CAFE', businessLines: ['food'] });

            const response = await patch({ menuUrl: 'https://example.com/carta' });

            expect(response.status, await response.clone().text()).toBe(403);
            expect((await response.json()).error).toMatchObject({
                code: 'ENTITLEMENT_REQUIRED',
                details: { entitlementKey: 'manage_venue_menu' }
            });
            expect(fakeModel.update).not.toHaveBeenCalled();
        });

        it('control: support still edits a common field (action 15 permits it)', async () => {
            resetStore({ type: 'CAFE', businessLines: ['food'] });

            const response = await patch({ name: 'Nuevo nombre' }, supportHeaders());

            expect(response.status, await response.clone().text()).toBe(200);
        });
    });
});
