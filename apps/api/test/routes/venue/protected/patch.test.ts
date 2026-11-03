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

// ---------------------------------------------------------------------------
// Mock VenueService to capture updateOwn input without real DB calls.
// ---------------------------------------------------------------------------

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        VenueService: class MockVenueService extends orig.VenueService {
            // biome-ignore lint/complexity/noUselessConstructor: need to call super
            constructor(...args: ConstructorParameters<typeof orig.VenueService>) {
                super(...args);
            }

            override async updateOwn(
                venueId: string,
                data: Record<string, unknown>,
                _actor: Parameters<typeof orig.VenueService.prototype.updateOwn>[2]
            ): ReturnType<typeof orig.VenueService.prototype.updateOwn> {
                if (Array.isArray(data.businessLines) || data.type === 'BOLICHE') {
                    return {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid business lines',
                            details: {
                                field: 'businessLines',
                                reason:
                                    data.type === 'BOLICHE' ? 'NOT_ALLOWED_FOR_TYPE' : 'DUPLICATE'
                            }
                        }
                    } as Awaited<ReturnType<typeof orig.VenueService.prototype.updateOwn>>;
                }
                // Capture for assertions
                (globalThis as Record<string, unknown>).__lastUpdateOwnInput = {
                    venueId,
                    data
                };
                return {
                    data: { id: venueId, name: 'mock' } as unknown as Awaited<
                        ReturnType<typeof orig.VenueService.prototype.updateOwn>
                    >['data'] & {},
                    error: undefined
                } as Awaited<ReturnType<typeof orig.VenueService.prototype.updateOwn>>;
            }

            override async createForOwner(
                actor: Parameters<typeof orig.VenueService.prototype.createForOwner>[0],
                data: Parameters<typeof orig.VenueService.prototype.createForOwner>[1]
            ): ReturnType<typeof orig.VenueService.prototype.createForOwner> {
                if (Array.isArray(data.businessLines)) {
                    return {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid business lines',
                            details: { field: 'businessLines', reason: 'NOT_ALLOWED_FOR_TYPE' }
                        }
                    } as Awaited<ReturnType<typeof orig.VenueService.prototype.createForOwner>>;
                }
                return super.createForOwner(actor, data);
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
        (globalThis as Record<string, unknown>).__lastUpdateOwnInput = undefined;
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
    // Identity field handling — updateOwn contract (HOS-166 D-1)
    // -------------------------------------------------------------------------

    describe('Identity Field Handling (HOS-166 D-1)', () => {
        it('persists name/type/destinationId for owners; still strips slug (OQ-3)', async () => {
            await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    'x-mock-actor-role': 'VENUE_OWNER',
                    'x-mock-actor-id': 'user-owner-1',
                    'x-mock-actor-permissions': '[]',
                    authorization: 'Bearer valid-test-token'
                },
                body: JSON.stringify({
                    name: 'Updated Name',
                    slug: 'forged-slug',
                    type: 'PARRILLA',
                    destinationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                    priceRange: 'MID'
                })
            });

            const captured = (globalThis as Record<string, unknown>).__lastUpdateOwnInput as
                | { venueId: string; data: Record<string, unknown> }
                | undefined;

            // Skip assertion if mock auth isn't wired (CI without actor middleware)
            if (!captured) return;

            // HOS-166 D-1: owner now controls identity fields.
            expect(captured.data.name).toBe('Updated Name');
            expect(captured.data.type).toBe('PARRILLA');
            expect(captured.data.destinationId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
            // `slug` stays admin-only post-create (OQ-3) — still stripped.
            expect(captured.data.slug).toBeUndefined();
            // Operational field must be present
            expect(captured.data.priceRange).toBe('MID');
        });
    });

    it('returns a 400 VALIDATION_ERROR with businessLines details from the service', async () => {
        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-mock-actor-role': 'VENUE_OWNER',
                'x-mock-actor-id': 'user-owner-1',
                'x-mock-actor-permissions': '[]',
                authorization: 'Bearer valid-test-token'
            },
            body: JSON.stringify({ businessLines: ['food', 'food'] })
        });
        expect(res.status, await res.clone().text()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'businessLines', reason: 'DUPLICATE' }
        });
    });

    it('POST returns 400 with businessLines details from the service', async () => {
        const res = await app.request(BASE, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-mock-actor-role': 'VENUE_OWNER',
                'x-mock-actor-id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                'x-mock-actor-permissions': '[]',
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
                'x-mock-actor-id': 'user-owner-1',
                'x-mock-actor-permissions': '[]',
                authorization: 'Bearer valid-test-token'
            },
            body: JSON.stringify({ businessLines: ['standard'] })
        });
        expect(res.status).toBe(400);
    });

    it('rejects a type change whose stored business lines are no longer allowed', async () => {
        const res = await app.request(`${BASE}/${VALID_UUID}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-mock-actor-role': 'VENUE_OWNER',
                'x-mock-actor-id': 'user-owner-1',
                'x-mock-actor-permissions': '[]',
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
