/**
 * HOS-2038 (TEST:5.0) — PATCH bodies whose section fields arrive all in `null`.
 *
 * Exercises the REAL protected PATCH route end to end: real
 * `enforceListingAccess` chain (ports mocked, as every route test does), real
 * `VenueService` write pipeline, and an in-memory model double that persists
 * the merged update so a second request can read the value back.
 *
 * A body that sends every field of a section in `null` declares that section
 * with `intent: 'delete'`: the owner may empty a section that is locked by
 * plan or hidden by the listing's business lines. A mixed body (some value)
 * stays a `write` and keeps the gate.
 */
import { PermissionEnum, PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
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
const STAFF_ID = '55555555-5555-4555-8555-555555555555';
const VENUE_ID = '33333333-3333-4333-8333-333333333333';

const NIGHT_FIELDS = [
    'entryKind',
    'entryNoteI18n',
    'entryPriceFrom',
    'minAge',
    'dressCode',
    'dressCodeNoteI18n'
] as const;

/** Effective-set keys of the subject: mutable per test. */
let effectiveKeys: string[] = ['edit_venue_info'];

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
            minAge: null,
            dressCode: null,
            dressCodeNoteI18n: null,
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
                entries: effectiveKeys.map((key) => ({ key, value: 1, strategy: 'MAX' }))
            }),
        preTrialDraftLimits: async () => ({})
    })
}));

function headers(
    actorId: string,
    permissions: string[] = [],
    role = 'VENUE_OWNER'
): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': role,
        'x-mock-actor-permissions': JSON.stringify(permissions),
        authorization: 'Bearer valid-test-token'
    };
}

const ownerHeaders = () => headers(OWNER_ID, [PermissionEnum.VENUE_EDIT_OWN]);
const otherHeaders = () => headers(OTHER_ID, []);
const staffHeaders = () =>
    headers(
        STAFF_ID,
        [
            PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
            PermissionEnum.VENUE_EDIT_ALL,
            PermissionEnum.VENUE_VIEW_ALL
        ],
        'ADMIN'
    );

function resetStore(overrides: Record<string, unknown> = {}): void {
    store.row = {
        ...store.row,
        id: VENUE_ID,
        ownerId: OWNER_ID,
        type: 'BOLICHE',
        businessLines: ['nightlife'],
        publicationStatus: PublicationStatusEnum.DRAFT,
        menuUrl: null,
        entryKind: null,
        entryNoteI18n: null,
        entryPriceFrom: null,
        entryPriceUpdatedAt: null,
        minAge: null,
        dressCode: null,
        dressCodeNoteI18n: null,
        ...overrides
    };
}

/** Status assertion that prints the real body when it fails, so a "before" measurement is readable. */
async function withBody(response: Response): Promise<{
    status: number;
    body: Record<string, unknown> | null;
}> {
    const text = await response.clone().text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
}

/** Response envelope as the tests read it: `data` holds the venue row. */
type ApiEnvelope = { readonly data: Record<string, unknown> } & Record<string, unknown>;

async function expectStatus(response: Response, status: number): Promise<ApiEnvelope> {
    const actual = await withBody(response);
    expect(actual.status, JSON.stringify(actual.body)).toBe(status);
    return actual.body as ApiEnvelope;
}

describe('PATCH null-is-delete over the protected venue routes (HOS-2038)', () => {
    let app: AppOpenAPI;

    // HOS-2048: importing the whole app costs ~7s cold and crossed the 30s
    // hookTimeout under CI contention; the venue router alone is ~5s. The
    // prefix-wide protected gates (mustChangePasswordGate, per-user rate
    // limit) are not mounted here: this suite never asserted them, and they
    // have their own suites under test/middlewares and test/routes.
    beforeAll(async () => {
        const [{ createApp }, { protectedVenueRoutes }] = await Promise.all([
            import('../../../../src/utils/create-app.js'),
            import('../../../../src/routes/venue/index.js')
        ]);
        app = createApp();
        app.route(BASE, protectedVenueRoutes);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        effectiveKeys = ['edit_venue_info'];
        resetStore();
    });

    const patch = (body: unknown, actorHeaders = ownerHeaders()) =>
        app.request(`${BASE}/${VENUE_ID}`, {
            method: 'PATCH',
            headers: actorHeaders,
            body: JSON.stringify(body)
        });

    // -----------------------------------------------------------------------
    // TEST:5.0:1 — locked menu can be emptied
    // -----------------------------------------------------------------------

    it('TEST:5.0:1 clears menuUrl for an owner whose menu is locked by plan', async () => {
        resetStore({ businessLines: ['food'], menuUrl: 'https://example.com/carta' });

        const response = await patch({ menuUrl: null });
        await expectStatus(response, 200);
        expect(store.row.menuUrl).toBeNull();

        // The 2xx above proves nothing on its own: read it back with an empty PATCH.
        const readBack = await patch({});
        const readBackBody = await expectStatus(readBack, 200);
        expect(readBackBody.data.menuUrl).toBeNull();
    });

    it('TEST:5.0:1 control: writing a menu value without manage_venue_menu is 403', async () => {
        resetStore({ businessLines: ['food'], menuUrl: 'https://example.com/carta' });

        const response = await patch({ menuUrl: 'https://example.com/otra' });
        const body = await expectStatus(response, 403);
        expect(body.error).toMatchObject({
            code: 'ENTITLEMENT_REQUIRED',
            details: { entitlementKey: 'manage_venue_menu' }
        });
        expect(store.row.menuUrl).toBe('https://example.com/carta');
    });

    // -----------------------------------------------------------------------
    // TEST:5.0:2 — section hidden by the business lines can be emptied
    // -----------------------------------------------------------------------

    it('TEST:5.0:2 clears the six nightInfo fields for an owner of a BAR without nightlife', async () => {
        resetStore({
            type: 'BAR',
            businessLines: ['food'],
            entryKind: 'free',
            entryNoteI18n: { es: 'Sin nota', en: 'No note', pt: 'Sem nota' },
            entryPriceFrom: null,
            minAge: 18,
            dressCode: 'casual',
            dressCodeNoteI18n: { es: 'Sin nota', en: 'No note', pt: 'Sem nota' }
        });

        const nulls = Object.fromEntries(NIGHT_FIELDS.map((field) => [field, null]));
        const response = await patch(nulls);
        await expectStatus(response, 200);
        for (const field of NIGHT_FIELDS) expect(store.row[field]).toBeNull();

        const readBack = await patch({});
        const readBackBody = await expectStatus(readBack, 200);
        for (const field of NIGHT_FIELDS) expect(readBackBody.data[field]).toBeNull();
    });

    it('TEST:5.0:2 control: writing minAge on a hidden nightInfo is 409', async () => {
        resetStore({
            type: 'BAR',
            businessLines: ['food'],
            entryKind: 'free',
            minAge: 18,
            dressCode: 'casual'
        });

        const response = await patch({ minAge: 20 });
        const body = await expectStatus(response, 409);
        expect(body.error).toMatchObject({
            details: { reason: 'SECTION_ABSENT', section: 'nightInfo' }
        });
        expect(store.row.minAge).toBe(18);
    });

    // -----------------------------------------------------------------------
    // TEST:5.0:3 — a mixed body is still a write
    // -----------------------------------------------------------------------

    it('TEST:5.0:3a keeps a same-section mix as a write (409) and leaves the row intact', async () => {
        resetStore({
            type: 'BAR',
            businessLines: ['food'],
            entryKind: 'free',
            entryNoteI18n: { es: 'Sin nota', en: 'No note', pt: 'Sem nota' },
            minAge: 18,
            dressCode: 'casual',
            dressCodeNoteI18n: { es: 'Sin nota', en: 'No note', pt: 'Sem nota' }
        });

        const response = await patch({ entryKind: null, minAge: 20 });
        const body = await expectStatus(response, 409);
        expect(body.error).toMatchObject({
            details: { reason: 'SECTION_ABSENT', section: 'nightInfo' }
        });
        expect(store.row.entryKind).toBe('free');
        expect(store.row.minAge).toBe(18);
    });

    it('TEST:5.0:3b rejects a cross-section mix atomically and does not clear menuUrl', async () => {
        resetStore({
            businessLines: ['food'],
            menuUrl: 'https://example.com/carta',
            minAge: 18
        });

        const response = await patch({ menuUrl: null, minAge: 20 });
        await expectStatus(response, 409);
        expect(store.row.menuUrl).toBe('https://example.com/carta');
        expect(store.row.minAge).toBe(18);
    });

    it('TEST:5.0:3c keeps a locked menu value protected when another section is mixed in', async () => {
        resetStore({
            type: 'BAR',
            businessLines: ['food', 'nightlife'],
            menuUrl: 'https://example.com/carta',
            minAge: 18
        });

        const response = await patch({ menuUrl: 'https://example.com/otra', minAge: 20 });
        const body = await expectStatus(response, 403);
        expect(body.error).toMatchObject({
            code: 'ENTITLEMENT_REQUIRED',
            details: { entitlementKey: 'manage_venue_menu' }
        });
        expect(store.row.menuUrl).toBe('https://example.com/carta');
    });

    // -----------------------------------------------------------------------
    // TEST:5.0:4 — a partial section (one sent field, in null) is a delete
    // -----------------------------------------------------------------------

    it('TEST:5.0:4 clears a single nulled field of a hidden section without touching its siblings', async () => {
        resetStore({
            type: 'BAR',
            businessLines: ['food'],
            entryKind: 'free',
            entryNoteI18n: { es: 'Sin nota', en: 'No note', pt: 'Sem nota' },
            minAge: 18,
            dressCode: 'casual',
            dressCodeNoteI18n: { es: 'Sin nota', en: 'No note', pt: 'Sem nota' }
        });

        const response = await patch({ dressCodeNoteI18n: null });
        await expectStatus(response, 200);
        expect(store.row.dressCodeNoteI18n).toBeNull();
        expect(store.row.entryKind).toBe('free');
        expect(store.row.entryNoteI18n).toEqual({ es: 'Sin nota', en: 'No note', pt: 'Sem nota' });
        expect(store.row.minAge).toBe(18);
        expect(store.row.dressCode).toBe('casual');

        const readBack = await patch({});
        const readBackBody = await expectStatus(readBack, 200);
        expect(readBackBody.data.dressCodeNoteI18n).toBeNull();
    });

    // -----------------------------------------------------------------------
    // TEST:5.0:5 — a third party still gets 404
    // -----------------------------------------------------------------------

    it('TEST:5.0:5 returns 404 to a third party sending the all-null menu body', async () => {
        resetStore({ businessLines: ['food'], menuUrl: 'https://example.com/carta' });

        const response = await patch({ menuUrl: null }, otherHeaders());
        await expectStatus(response, 404);
        expect(store.row.menuUrl).toBe('https://example.com/carta');
    });

    it('TEST:5.0:5 returns 404 to a third party sending the all-null nightInfo body', async () => {
        resetStore({
            type: 'BAR',
            businessLines: ['food'],
            entryKind: 'free',
            minAge: 18,
            dressCode: 'casual'
        });

        const nulls = Object.fromEntries(NIGHT_FIELDS.map((field) => [field, null]));
        const response = await patch(nulls, otherHeaders());
        await expectStatus(response, 404);
        expect(store.row.entryKind).toBe('free');
    });

    it('TEST:5.0:5 still answers validation (400) before existence for a third party', async () => {
        resetStore({ type: 'BAR', businessLines: ['food'] });

        const response = await patch({ minAge: 12 }, otherHeaders());
        await expectStatus(response, 400);
    });

    // -----------------------------------------------------------------------
    // TEST:5.0:6 — action-15 staff does not regress
    // -----------------------------------------------------------------------

    it('TEST:5.0:6 keeps an action-15 staff all-null nightInfo PATCH working on a foreign hidden listing', async () => {
        resetStore({
            type: 'BAR',
            businessLines: ['food'],
            entryKind: 'free',
            entryNoteI18n: { es: 'Sin nota', en: 'No note', pt: 'Sem nota' },
            minAge: 18,
            dressCode: 'casual',
            dressCodeNoteI18n: { es: 'Sin nota', en: 'No note', pt: 'Sem nota' }
        });

        const nulls = Object.fromEntries(NIGHT_FIELDS.map((field) => [field, null]));
        const response = await patch(nulls, staffHeaders());
        await expectStatus(response, 200);
        for (const field of NIGHT_FIELDS) expect(store.row[field]).toBeNull();
    });
});
