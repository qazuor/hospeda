/**
 * TEST:3.12:2 — a venue listing with an impossible empty `business_lines` set.
 *
 * The degradation table distinguishes two real HTTP writes:
 * - a write to a NON-common section (the menu) must answer 500, and
 * - a basic-info edit (a common section) must still succeed.
 *
 * These go through the real `enforceListingAccess` chain and the real route
 * factory, not a synthetic middleware probe. The probe in
 * `test/middlewares/listing-access.test.ts` stays as the narrow unit; this file
 * proves the behavior of the routes that consume the authorization.
 */
import { PermissionEnum, PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const VENUE = '22222222-2222-4222-8222-222222222222';
const DESTINATION = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
    updateOwn: vi.fn(),
    replaceMenu: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        VenueService: Object.assign(
            vi.fn().mockImplementation(function () {
                return { updateOwn: mocks.updateOwn, model: {} };
            }),
            { ENTITY_NAME: 'venue' }
        ),
        replaceVenueMenu: mocks.replaceMenu
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: {
                ownerId: OWNER,
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                businessLines: [],
                // Persisted row value, not `null`: the write-integrity log must
                // identify the listing type even when the body omits it.
                type: 'RESTAURANT'
            },
            ownerId: OWNER
        }),
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'edit_venue_info', value: 1, strategy: 'MAX' }]
            })
    })
}));

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedPutVenueMenuRoute } = await import(
    '../../../../src/routes/venue/protected/putMenu.js'
);
const { protectedPatchVenueRoute } = await import(
    '../../../../src/routes/venue/protected/patch.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');

function venueFixture() {
    return {
        id: VENUE,
        ownerId: OWNER,
        type: 'RESTAURANT',
        businessLines: [],
        publicationStatus: 'PUBLISHED',
        name: 'Saved venue',
        slug: 'saved-venue',
        summary: 'A valid venue summary.',
        description: 'A sufficiently detailed description for this venue listing.',
        destinationId: DESTINATION,
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
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
    };
}

function buildApp() {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((ctx, next) => {
        ctx.set('actor', {
            id: OWNER,
            roles: [],
            permissions: [PermissionEnum.VENUE_EDIT_OWN]
        } as never);
        return next();
    });
    app.route('/', protectedPutVenueMenuRoute);
    app.route('/', protectedPatchVenueRoute);
    return app;
}

const json = { headers: { 'content-type': 'application/json' } };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateOwn.mockResolvedValue({ data: venueFixture() });
    mocks.replaceMenu.mockResolvedValue({
        data: { sections: [], file: null, externalUrl: null }
    });
});

describe('TEST:3.12:2 empty venue business lines over the real routes', () => {
    it('rejects a non-common section write through PUT /venues/{id}/menu with 500', async () => {
        const response = await buildApp().request(`/${VENUE}/menu`, {
            method: 'PUT',
            ...json,
            body: JSON.stringify({
                sections: [{ name: 'Entradas', items: [{ name: 'Empanada' }] }]
            })
        });
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error.code).toBe('INTERNAL_ERROR');
        expect(mocks.replaceMenu).not.toHaveBeenCalled();
    });

    it('allows a basic-info edit through PATCH /venues/{id} with 2xx', async () => {
        const response = await buildApp().request(`/${VENUE}`, {
            method: 'PATCH',
            ...json,
            body: JSON.stringify({ name: 'Updated venue name' })
        });

        expect(response.status).toBe(200);
        expect(mocks.updateOwn).toHaveBeenCalledTimes(1);
    });
});
