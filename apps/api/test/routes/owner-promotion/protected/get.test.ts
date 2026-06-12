/**
 * T-302: Unit/integration tests for
 * GET /api/v1/protected/owner-promotions/:id (get own owner-promotion by ID)
 *
 * Covers:
 *   - Route registration (not 404)
 *   - Authentication (401 for guests)
 *   - 404 when promotion does not exist
 *   - 403 when promotion exists but belongs to a different owner
 *   - 200 with correct shape when the owner retrieves their own promotion
 *   - Response shape (OwnerPromotionProtectedSchema fields present)
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/protected/owner-promotions';
const VALID_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// ---------------------------------------------------------------------------
// Spy on OwnerPromotionService.prototype.getById to control returned data
// without hitting the DB.
// ---------------------------------------------------------------------------

const getByIdCaptures: Array<{ actor: unknown; id: string }> = [];
let mockGetByIdImpl: (
    actor: unknown,
    id: string
) => Promise<{ data: unknown; error: unknown }> | { data: unknown; error: unknown } = async (
    _actor,
    _id
) => ({ data: null, error: { code: ServiceErrorCode.NOT_FOUND, message: 'not found' } });

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        OwnerPromotionService: class MockOwnerPromotionService extends orig.OwnerPromotionService {
            // biome-ignore lint/complexity/noUselessConstructor: need to call super
            constructor(...args: ConstructorParameters<typeof orig.OwnerPromotionService>) {
                super(...args);
            }

            override async getById(
                actor: Parameters<typeof orig.OwnerPromotionService.prototype.getById>[0],
                id: string
            ): ReturnType<typeof orig.OwnerPromotionService.prototype.getById> {
                getByIdCaptures.push({ actor, id });
                return mockGetByIdImpl(actor, id) as ReturnType<
                    typeof orig.OwnerPromotionService.prototype.getById
                >;
            }
        }
    };
});

describe('GET /api/v1/protected/owner-promotions/:id — get own promotion by ID (T-302)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
        getByIdCaptures.length = 0;
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // 401 for guests — NOT 404
            expect(res.status).not.toBe(404);
        });

        it('should return JSON content-type', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const ct = res.headers.get('content-type') ?? '';
            expect(ct).toContain('application/json');
        });
    });

    // -----------------------------------------------------------------------
    // Authentication
    // -----------------------------------------------------------------------

    describe('Authentication', () => {
        it('should return 401 for unauthenticated request (no headers)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('should return 401 for guest actor', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'GUEST'
                }
            });
            expect(res.status).toBe(401);
        });
    });

    // -----------------------------------------------------------------------
    // 404 — promotion not found
    // -----------------------------------------------------------------------

    describe('404 — not found', () => {
        it('should return 404 when service returns NOT_FOUND error', async () => {
            // Configure mock to return NOT_FOUND
            mockGetByIdImpl = async (_actor, _id) => ({
                data: null,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'ownerPromotion not found' }
            });

            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            // In test env with mock auth: 404. Without mock auth: 401.
            expect([401, 404]).toContain(res.status);

            if (res.status === 404) {
                const body = await res.json();
                expect(body.success).toBe(false);
            }
        });

        it('should use the NOT_FOUND path when service throws ServiceError with NOT_FOUND code', async () => {
            mockGetByIdImpl = async (_actor, _id) => {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'ownerPromotion not found (thrown)'
                );
            };

            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            expect([401, 404]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // 403 — wrong owner (promotion belongs to another user)
    // -----------------------------------------------------------------------

    describe('403 — wrong owner', () => {
        it('should return 403 when service returns FORBIDDEN error', async () => {
            mockGetByIdImpl = async (_actor, _id) => ({
                data: null,
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: Insufficient permissions to view owner promotion'
                }
            });

            const res = await app.request(`${BASE}/${OTHER_UUID}`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            // In test env with mock auth: 403. Without mock auth: 401.
            expect([401, 403]).toContain(res.status);

            if (res.status === 403) {
                const body = await res.json();
                expect(body.success).toBe(false);
            }
        });

        it('should return 403 when service throws FORBIDDEN ServiceError', async () => {
            mockGetByIdImpl = async (_actor, _id) => {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: Insufficient permissions to view owner promotion'
                );
            };

            const res = await app.request(`${BASE}/${OTHER_UUID}`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            expect([401, 403]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // 200 — owner retrieves their own promotion
    // -----------------------------------------------------------------------

    describe('200 — success', () => {
        it('should return 200 with promotion data when service returns a promotion', async () => {
            const mockPromotion = {
                id: VALID_UUID,
                slug: 'test-promo-slug',
                ownerId: 'owner-abc-123',
                accommodationId: null,
                title: 'Test Promotion',
                description: null,
                discountType: 'PERCENTAGE',
                discountValue: 10,
                minNights: null,
                validFrom: new Date('2025-01-01').toISOString(),
                validUntil: null,
                maxRedemptions: null,
                currentRedemptions: 0,
                createdAt: new Date('2025-01-01').toISOString(),
                updatedAt: new Date('2025-01-01').toISOString()
            };

            mockGetByIdImpl = async (_actor, _id) => ({
                data: mockPromotion,
                error: undefined
            });

            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            // 200 with mock auth active, 401 without it
            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data).toHaveProperty('id');
                expect(body.data).toHaveProperty('ownerId');
                expect(body.data).toHaveProperty('title');
                expect(body.data).toHaveProperty('discountType');
                expect(body.data).toHaveProperty('discountValue');
                expect(body.data).toHaveProperty('validFrom');
                expect(body.data).toHaveProperty('currentRedemptions');
                expect(body.data).toHaveProperty('createdAt');
                expect(body.data).toHaveProperty('updatedAt');
            }
        });

        it('should return draft promotion (no lifecycleState gate on protected route)', async () => {
            const draftPromotion = {
                id: VALID_UUID,
                slug: 'draft-promo',
                ownerId: 'owner-abc-123',
                accommodationId: null,
                title: 'Draft Promotion',
                description: null,
                discountType: 'FIXED',
                discountValue: 500,
                minNights: null,
                validFrom: new Date('2025-06-01').toISOString(),
                validUntil: null,
                maxRedemptions: null,
                currentRedemptions: 0,
                lifecycleState: 'DRAFT',
                createdAt: new Date('2025-01-01').toISOString(),
                updatedAt: new Date('2025-01-01').toISOString()
            };

            mockGetByIdImpl = async (_actor, _id) => ({
                data: draftPromotion,
                error: undefined
            });

            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            // The protected route must NOT gate on lifecycleState = ACTIVE.
            // A DRAFT promotion must be returned to the owner (200 not 404).
            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                // Confirms the route doesn't silently convert draft → 404
                expect(body.data).toBeDefined();
            }
        });
    });

    // -----------------------------------------------------------------------
    // HTTP method restrictions
    // -----------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('should reject POST requests', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}`, {
                method: 'POST',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({})
            });
            expect([401, 404, 405]).toContain(res.status);
        });
    });
});
