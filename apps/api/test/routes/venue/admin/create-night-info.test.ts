/**
 * HOS-2052 (TEST:2052:1, AC:G:4, AC:G:5).
 *
 * Exercises the REAL admin POST route end to end: the real `VenueService`
 * create pipeline over an in-memory model double, with `enforceListingAccess`
 * mocked exactly as the other admin route tests do (it has no database). The
 * listing-access shortcut itself is untouched: the POST still declares no
 * `listingSection`.
 *
 * `HOSPEDA_API_DEBUG_ERRORS` is OFF on purpose: the absent-section `details`
 * must be published because the route propagates `result.error.reason`, not
 * because the debug flag echoed everything.
 *
 * Types and business lines are read from the catalog
 * (`BUSINESS_LINE_RULES`, `listPublicBusinessLines`,
 * `resolveSectionBusinessLines`), never written as literals (G-FAC-03).
 */
import {
    BUSINESS_LINE_RULES,
    listPublicBusinessLines,
    resolveSectionBusinessLines,
    VenueEntryKindEnum
} from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppOpenAPI } from '../../../../src/types.js';

delete process.env.CI;
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_API_DEBUG_ERRORS = 'false';

vi.mock('../../../../src/middlewares/listing-access', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../../src/middlewares/listing-access')>();
    return { ...actual, enforceListingAccess: vi.fn(async () => undefined) };
});

const BASE = '/api/v1/admin/venues';
const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

const { fakeModel, fakeDestinationModel } = vi.hoisted(() => ({
    fakeModel: { findById: vi.fn(), update: vi.fn(), create: vi.fn(), findOne: vi.fn() },
    fakeDestinationModel: { findById: vi.fn() }
}));

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
                // `_beforeCreate` validates the destination against a CITY row;
                // this has to stay in memory like the venue model.
                Object.defineProperty(this, '_destinationModel', {
                    value: fakeDestinationModel
                });
            }
        }
    };
});

const USER_AGENT = { 'user-agent': 'vitest' };

const adminHeaders = {
    ...USER_AGENT,
    'content-type': 'application/json',
    'x-mock-actor-id': ADMIN_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify([
        'access.panelAdmin',
        'venue.editAll',
        'venue.create',
        'venue.viewAll'
    ])
};

/** A complete row so the admin response schema parses it. */
function venueRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: VALID_UUID,
        ownerId: OWNER_ID,
        type: 'BAR',
        businessLines: ['food', 'nightlife'],
        publicationStatus: 'DRAFT',
        name: 'Saved venue',
        slug: 'saved-venue',
        summary: 'Una ficha de prueba.',
        description: 'Descripción detallada para la ficha de prueba.',
        destinationId: VALID_UUID,
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
        minAge: null,
        dressCode: null,
        dressCodeNoteI18n: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        ...overrides
    };
}

type TypeRule = { readonly allowed: readonly string[]; readonly preselect: readonly string[] };

/** Business lines the catalog says offer `nightInfo`. */
const offeringLines: string[] = resolveSectionBusinessLines({
    vertical: 'venue',
    sectionId: 'nightInfo'
}).map((line) => line.value);

/** Every public venue business line, for assertions about the in-memory row. */
const publicLines = listPublicBusinessLines({ vertical: 'venue' }).map((line) => line.value);

const typeEntries = Object.entries(BUSINESS_LINE_RULES.venue.typeRules) as unknown as Array<
    [string, TypeRule]
>;

/** A venue type whose preselection offers the night section. */
const typeWithNight = typeEntries.find(([, rules]) =>
    rules.preselect.some((line) => offeringLines.includes(line))
)?.[0];

/** A venue type whose preselection does not offer the night section. */
const typeWithoutNight = typeEntries.find(
    ([, rules]) => !rules.preselect.some((line) => offeringLines.includes(line))
)?.[0];
const rulesWithoutNight = typeEntries.find(([value]) => value === typeWithoutNight)?.[1];

if (!typeWithNight || !typeWithoutNight || !rulesWithoutNight || offeringLines.length === 0) {
    throw new Error('the venue catalog no longer offers a nightlife section');
}

if (publicLines.length === 0) {
    throw new Error('the venue catalog has no public business lines');
}

function createBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        name: 'Alta de prueba',
        slug: 'alta-de-prueba',
        summary: 'Una ficha de prueba para el alta.',
        description: 'Descripción detallada para la ficha de prueba del alta.',
        type: typeWithoutNight,
        ownerId: OWNER_ID,
        destinationId: VALID_UUID,
        ...overrides
    };
}

describe('Admin venue create — nightInfo section presence (HOS-2052)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        const { initApp } = await import('../../../../src/app.js');
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        fakeModel.findOne.mockResolvedValue(null);
        fakeModel.create.mockImplementation(async (data: Record<string, unknown>) =>
            venueRow(data)
        );
        fakeDestinationModel.findById.mockResolvedValue({
            id: VALID_UUID,
            destinationType: 'CITY'
        });
    });

    async function post(body: Record<string, unknown>): Promise<Response> {
        return app.request(BASE, {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify(body)
        });
    }

    it('rejects entryKind on a type whose preselection does not offer nightInfo', async () => {
        const res = await post(createBody({ entryKind: VenueEntryKindEnum.FREE }));

        expect(res.status, await res.clone().text()).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toEqual({ reason: 'SECTION_ABSENT', section: 'nightInfo' });
        expect(fakeModel.create).not.toHaveBeenCalled();
    });

    it('rejects minAge with explicit business lines that exclude nightlife', async () => {
        const res = await post(
            createBody({
                type: typeWithoutNight,
                businessLines: [...rulesWithoutNight.preselect],
                minAge: 18
            })
        );

        expect(res.status, await res.clone().text()).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toEqual({ reason: 'SECTION_ABSENT', section: 'nightInfo' });
        expect(fakeModel.create).not.toHaveBeenCalled();
    });

    it('creates the listing when the explicit business lines offer nightInfo', async () => {
        const res = await post(
            createBody({
                type: typeWithNight,
                businessLines: [...offeringLines],
                entryKind: VenueEntryKindEnum.FREE,
                minAge: 18
            })
        );

        expect(res.status, await res.clone().text()).toBe(201);
        const payload = fakeModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload.entryKind).toBe(VenueEntryKindEnum.FREE);
        expect(payload.minAge).toBe(18);
    });

    it('creates the listing when the type preselection offers nightInfo', async () => {
        const res = await post(
            createBody({ type: typeWithNight, entryKind: VenueEntryKindEnum.FREE })
        );

        expect(res.status, await res.clone().text()).toBe(201);
        expect(fakeModel.create).toHaveBeenCalledTimes(1);
    });

    it('creates a listing with no nightInfo fields (control)', async () => {
        const res = await post(createBody());

        expect(res.status, await res.clone().text()).toBe(201);
        expect(fakeModel.create).toHaveBeenCalledTimes(1);
    });

    it('treats an explicit null entryKind as no touch', async () => {
        const res = await post(createBody({ entryKind: null }));

        expect(res.status, await res.clone().text()).toBe(201);
        expect(fakeModel.create).toHaveBeenCalledTimes(1);
    });
});
