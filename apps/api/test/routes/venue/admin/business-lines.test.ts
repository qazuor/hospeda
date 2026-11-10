/**
 * Tests for business-line handling on the admin venue routes (HOS-1787 leaf 7.1).
 *
 * Covers AC:7:3 from the admin surface:
 *  - PATCH an HELADERIA with `nightlife` -> 400 NOT_ALLOWED_FOR_TYPE, no write;
 *  - PATCH a BAR to HELADERIA without sending lines -> 400 (stored lines checked);
 *  - POST an HELADERIA with `nightlife` -> 400;
 *  - PATCH a BAR to `nightlife` -> 200 and the response carries `data.businessLines`
 *    (this is the end-to-end proof of the admin response projection);
 *  - GET the list with `businessLine=standard` -> 400 (request shape).
 *
 * Pattern follows `test/routes/venue/protected/patch.test.ts`: boot the real
 * app, inject `fakeModel` into a `VenueService` subclass, and mock the
 * listing-access middleware plus the owner-act writer (neither has a database).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppOpenAPI } from '../../../../src/types.js';

delete process.env.CI;
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_API_DEBUG_ERRORS = 'true';

vi.mock('../../../../src/middlewares/listing-access', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../../src/middlewares/listing-access')>();
    return { ...actual, enforceListingAccess: vi.fn(async () => undefined) };
});

const BASE = '/api/v1/admin/venues';
const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';

const { fakeModel } = vi.hoisted(() => ({
    fakeModel: { findById: vi.fn(), update: vi.fn(), create: vi.fn(), findOne: vi.fn() }
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
            }
        }
    };
});

const USER_AGENT = { 'user-agent': 'vitest' };
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

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
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        ...overrides
    };
}

describe('Admin venue business lines — HOS-1787 7.1 (AC:7:3)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        const { initApp } = await import('../../../../src/app.js');
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        fakeModel.findOne.mockResolvedValue(null);
        fakeModel.findById.mockResolvedValue(
            venueRow({ type: 'HELADERIA', businessLines: ['food', 'nightlife'] })
        );
        fakeModel.update.mockImplementation(
            async (_where: unknown, data: Record<string, unknown>) =>
                venueRow({ type: 'HELADERIA', businessLines: ['food', 'nightlife'], ...data })
        );
        fakeModel.create.mockResolvedValue(
            venueRow({ type: 'HELADERIA', businessLines: ['nightlife'] })
        );
    });

    it('rejects an HELADERIA carrying nightlife on PATCH without writing', async () => {
        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: adminHeaders,
            body: JSON.stringify({ businessLines: ['food', 'nightlife'] })
        });

        expect(res.status, await res.clone().text()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'businessLines', reason: 'NOT_ALLOWED_FOR_TYPE' }
        });
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    it('rejects a type change whose stored lines are no longer allowed', async () => {
        fakeModel.findById.mockResolvedValue(
            venueRow({ type: 'BAR', businessLines: ['food', 'nightlife'] })
        );

        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: adminHeaders,
            body: JSON.stringify({ type: 'HELADERIA' })
        });

        expect(res.status, await res.clone().text()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'businessLines', reason: 'NOT_ALLOWED_FOR_TYPE' }
        });
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    it('rejects an HELADERIA created with nightlife', async () => {
        const res = await app.request(BASE, {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({
                name: 'Heladería con noche',
                slug: 'heladeria-con-noche',
                summary: 'Una ficha de prueba para el alta.',
                description: 'Descripción detallada para la ficha de prueba del alta.',
                type: 'HELADERIA',
                ownerId: OWNER_ID,
                destinationId: VALID_UUID,
                businessLines: ['nightlife']
            })
        });

        expect(res.status, await res.clone().text()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'businessLines', reason: 'NOT_ALLOWED_FOR_TYPE' }
        });
        expect(fakeModel.create).not.toHaveBeenCalled();
    });

    it('accepts nightlife for a BAR and returns businessLines', async () => {
        fakeModel.findById.mockResolvedValue(
            venueRow({ type: 'BAR', businessLines: ['food', 'nightlife'] })
        );

        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: adminHeaders,
            body: JSON.stringify({ businessLines: ['nightlife'] })
        });

        expect(res.status, await res.clone().text()).toBe(200);
        const body = await res.json();
        expect(body.data.businessLines).toEqual(['nightlife']);
    });

    it('rejects a list filter with a business line from another vertical', async () => {
        const res = await app.request(`${BASE}?businessLine=standard`, {
            method: 'GET',
            headers: adminHeaders
        });

        expect(res.status).toBe(400);
    });
});
