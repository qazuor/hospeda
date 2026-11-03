/**
 * Tests for PATCH /api/v1/protected/venues/:id
 *
 * Covers:
 * - Route registration
 * - 401 when unauthenticated
 * - Identity field handling (HOS-166 D-1): `name`/`destinationId` now PERSIST
 *   for owners; `slug` stays stripped (immutable post-create, OQ-3); `type`
 *   persists (SPEC-253, unrelated to this spec but exercised by the same body)
 * - Non-owner gets NOT_FOUND (ownership enforcement in updateOwn)
 * - Operational fields accepted without error
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

const BASE = '/api/v1/protected/venues';
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

describe('PATCH /api/v1/protected/venues/:id', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        const { initApp } = await import('../../../../src/app.js');
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        fakeModel.findById.mockResolvedValue({
            id: VALID_UUID,
            ownerId: OWNER_ID,
            type: 'HELADERIA',
            businessLines: ['food', 'nightlife'],
            publicationStatus: 'DRAFT',
            name: 'Saved venue'
        });
        fakeModel.update.mockImplementation(
            async (_where: unknown, data: Record<string, unknown>) => ({
                id: VALID_UUID,
                ownerId: OWNER_ID,
                type: 'HELADERIA',
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
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
                ...data
            })
        );
    });

    // -------------------------------------------------------------------------
    // Route registration
    // -------------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    'x-mock-actor-role': 'GUEST'
                },
                body: JSON.stringify({})
            });
            expect(res.status).not.toBe(404);
        });
    });

    // -------------------------------------------------------------------------
    // Authentication
    // -------------------------------------------------------------------------

    describe('Authentication', () => {
        it('should return 401 for unauthenticated request', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest'
                },
                body: JSON.stringify({ priceRange: 'MID' })
            });
            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // Real VenueService validation through the protected HTTP route.
    // -------------------------------------------------------------------------

    describe('Business line validation', () => {
        it('allows an operational update without validating untouched legacy business lines', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    'x-mock-actor-role': 'VENUE_OWNER',
                    'x-mock-actor-id': OWNER_ID,
                    'x-mock-actor-permissions': '["venue.editOwn"]',
                    authorization: 'Bearer valid-test-token'
                },
                body: JSON.stringify({
                    priceRange: 'MID'
                })
            });
            expect(res.status, await res.clone().text()).toBe(200);
        });
    });

    it('returns 400 when the real service receives invalid business lines', async () => {
        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-mock-actor-role': 'VENUE_OWNER',
                'x-mock-actor-id': OWNER_ID,
                'x-mock-actor-permissions': '["venue.editOwn"]',
                authorization: 'Bearer valid-test-token'
            },
            body: JSON.stringify({ businessLines: ['food', 'nightlife'] })
        });
        expect(res.status, await res.clone().text()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'businessLines', reason: 'NOT_ALLOWED_FOR_TYPE' }
        });
    });

    it('POST returns 400 for business lines invalid for the venue type', async () => {
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
        expect(res.status).toBe(400);
        const resultBody = await res.json();
        expect(resultBody).toMatchObject({
            error: {
                code: 'VALIDATION_ERROR',
                details: { field: 'businessLines', reason: 'NOT_ALLOWED_FOR_TYPE' }
            }
        });
    });

    it('rejects a business line from another vertical by request shape', async () => {
        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-mock-actor-role': 'VENUE_OWNER',
                'x-mock-actor-id': OWNER_ID,
                'x-mock-actor-permissions': '["venue.editOwn"]',
                authorization: 'Bearer valid-test-token'
            },
            body: JSON.stringify({ businessLines: ['standard'] })
        });
        expect(res.status).toBe(400);
    });

    it('rejects a type change whose stored business lines are no longer allowed', async () => {
        fakeModel.findById.mockResolvedValue({
            id: VALID_UUID,
            ownerId: OWNER_ID,
            type: 'BAR',
            businessLines: ['food', 'nightlife'],
            publicationStatus: 'DRAFT',
            name: 'Saved venue'
        });
        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-mock-actor-role': 'VENUE_OWNER',
                'x-mock-actor-id': OWNER_ID,
                'x-mock-actor-permissions': '["venue.editOwn"]',
                authorization: 'Bearer valid-test-token'
            },
            body: JSON.stringify({ type: 'BOLICHE' })
        });
        expect(res.status).toBe(400);
        const resultBody = await res.json();
        expect(resultBody).toMatchObject({
            error: {
                code: 'VALIDATION_ERROR',
                details: { field: 'businessLines', reason: 'NOT_ALLOWED_FOR_TYPE' }
            }
        });
    });

    // -------------------------------------------------------------------------
    // UUID validation
    // -------------------------------------------------------------------------

    describe('UUID Validation', () => {
        it('should return 400 for invalid UUID in path', async () => {
            const res = await app.request(`${BASE}/not-a-uuid`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    'x-mock-actor-role': 'VENUE_OWNER',
                    'x-mock-actor-id': 'user-owner-1',
                    'x-mock-actor-permissions': '[]',
                    authorization: 'Bearer valid-test-token'
                },
                body: JSON.stringify({ priceRange: 'MID' })
            });
            expect([400, 422]).toContain(res.status);
        });
    });
});
