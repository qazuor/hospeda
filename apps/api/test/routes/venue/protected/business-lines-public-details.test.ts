/**
 * DEC-FAC-080 — the business-line 400 publishes its cause in production.
 *
 * The owner form shows the rejected business-line rule by reading
 * `error.details.field` / `error.details.reason`
 * (`apps/web/src/lib/forms/field-errors.ts`). `handleRouteError` used to strip
 * `details` unless `HOSPEDA_API_DEBUG_ERRORS` was on, so production fell back to
 * the generic banner. This test keeps the debug flag OFF on purpose: it is the
 * only configuration that proves the public contract instead of the dev escape
 * hatch.
 *
 * It goes through `initApp()` and the real protected POST/PATCH routes, so the
 * response is produced by the real `handleRouteError` — not by
 * `createErrorHandler`, which has always emitted every 4xx detail (HOS-700).
 * Both cases prove the same contract: the route must carry
 * `result.error.reason` into the thrown `ServiceError`; a gate on the shape of
 * `details` would let an unrelated `VALIDATION_ERROR` through.
 */
import { PermissionEnum } from '@repo/schemas';
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

const BASE = '/api/v1/protected/venues';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const { fakeModel } = vi.hoisted(() => {
    const row = {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        slug: 'night-venue',
        name: 'Night Venue',
        summary: 'A night venue summary.',
        description: 'A detailed description of this night venue for visitors.',
        type: 'HELADERIA',
        businessLines: ['food'],
        ownerId: '11111111-1111-4111-8111-111111111111',
        destinationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
    } as Record<string, unknown>;

    return {
        fakeModel: {
            findById: vi.fn(async () => ({ ...row })),
            update: vi.fn(async (_where: unknown, data: Record<string, unknown>) => ({
                ...row,
                ...data
            })),
            create: vi.fn(),
            findOne: vi.fn(async () => null)
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

describe('POST /api/v1/protected/venues — public business-line details', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        const { initApp } = await import('../../../../src/app.js');
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the validated cause with HOSPEDA_API_DEBUG_ERRORS off', async () => {
        const res = await app.request(BASE, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-mock-actor-role': 'VENUE_OWNER',
                'x-mock-actor-id': OWNER_ID,
                'x-mock-actor-permissions': '["venue.create"]',
                authorization: 'Bearer valid-test-token'
            },
            body: JSON.stringify({
                name: 'Venue with invalid business lines',
                summary: 'A valid summary for this venue',
                description: 'A sufficiently detailed description for the venue listing.',
                type: 'HELADERIA',
                destinationId: VALID_UUID,
                businessLines: ['nightlife']
            })
        });

        expect(res.status, await res.clone().text()).toBe(400);
        const body = (await res.json()) as {
            error: { code?: string; details?: { field?: string; reason?: string } };
        };
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details?.field).toBe('businessLines');
        expect(body.error.details?.reason).toBe('NOT_ALLOWED_FOR_TYPE');
    });

    it('returns the validated cause on PATCH with HOSPEDA_API_DEBUG_ERRORS off', async () => {
        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-mock-actor-role': 'VENUE_OWNER',
                'x-mock-actor-id': OWNER_ID,
                'x-mock-actor-permissions': JSON.stringify([PermissionEnum.VENUE_EDIT_OWN]),
                authorization: 'Bearer valid-test-token'
            },
            body: JSON.stringify({ businessLines: ['nightlife'] })
        });

        expect(res.status, await res.clone().text()).toBe(400);
        const body = (await res.json()) as {
            error: { code?: string; details?: { field?: string; reason?: string } };
        };
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details?.field).toBe('businessLines');
        expect(body.error.details?.reason).toBe('NOT_ALLOWED_FOR_TYPE');
    });
});
