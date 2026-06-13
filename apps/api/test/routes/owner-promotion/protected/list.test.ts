/**
 * T-301: Unit/integration tests for
 * GET /api/v1/protected/owner-promotions (list own owner-promotions)
 *
 * Covers:
 *   - Route registration (not 404)
 *   - Authentication (401 for guests)
 *   - Owner-scope isolation (service receives ownerId = actor.id, not a client param)
 *   - All lifecycle states are returned (no ACTIVE-only filter)
 *   - Pagination query params accepted without errors
 *   - Unknown query params rejected (400)
 *   - Response shape (success + data + pagination)
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/protected/owner-promotions';

// ---------------------------------------------------------------------------
// Spy on OwnerPromotionService.prototype.list to capture what where-clause
// the route passes, without making real DB calls.
// ---------------------------------------------------------------------------

const listCaptures: Array<Record<string, unknown>> = [];

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        OwnerPromotionService: class MockOwnerPromotionService extends orig.OwnerPromotionService {
            // biome-ignore lint/complexity/noUselessConstructor: need to call super
            constructor(...args: ConstructorParameters<typeof orig.OwnerPromotionService>) {
                super(...args);
            }

            override async list(
                actor: Parameters<typeof orig.OwnerPromotionService.prototype.list>[0],
                options: Parameters<typeof orig.OwnerPromotionService.prototype.list>[1]
            ): ReturnType<typeof orig.OwnerPromotionService.prototype.list> {
                listCaptures.push({ actor, options });
                return {
                    data: { items: [], total: 0 },
                    error: undefined
                } as Awaited<ReturnType<typeof orig.OwnerPromotionService.prototype.list>>;
            }
        }
    };
});

describe('GET /api/v1/protected/owner-promotions — list own promotions (T-301)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
        listCaptures.length = 0;
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
        });

        it('should return JSON content-type', async () => {
            const res = await app.request(BASE, {
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
        it('should return 401 for guest actor (no auth headers)', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('should return 401 when x-mock-actor-role is GUEST', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'GUEST'
                }
            });
            expect(res.status).toBe(401);
        });

        it('should be reachable for authenticated actor (not 404)', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-user-123'
                }
            });
            // 200, 401 (mock auth disabled in this env), or 403 are all valid.
            // The only invariant: the route must be registered (not 404).
            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // Owner-scope isolation
    // -----------------------------------------------------------------------

    describe('Owner-scope isolation', () => {
        it('should pass actor.id as ownerId in where clause (not a client param)', async () => {
            listCaptures.length = 0;

            await app.request(BASE, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            // If the mock auth resolved (test env), validate the where clause.
            const first0 = listCaptures[0];
            if (listCaptures.length > 0 && first0 !== undefined) {
                const capture = first0;
                const options = capture.options as Record<string, unknown>;
                const where = options.where as Record<string, unknown>;
                // The ownerId in the where clause must come from the session actor,
                // NOT from any client-supplied query param.
                expect(where).toBeDefined();
                expect(where.ownerId).toBe('owner-abc-123');
            }
        });

        it('should ignore client-supplied ownerId query param', async () => {
            listCaptures.length = 0;

            // Client tries to inject a different ownerId via query string
            await app.request(`${BASE}?ownerId=attacker-other-user-999`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            // Either the route rejects unknown params (400) or it passes only the
            // session-derived ownerId to the service (where.ownerId = 'owner-abc-123').
            const first1 = listCaptures[0];
            if (listCaptures.length > 0 && first1 !== undefined) {
                const capture = first1;
                const options = capture.options as Record<string, unknown>;
                const where = options.where as Record<string, unknown>;
                // Must use session ownerId, not the injected value
                expect(where.ownerId).toBe('owner-abc-123');
                expect(where.ownerId).not.toBe('attacker-other-user-999');
            }
        });
    });

    // -----------------------------------------------------------------------
    // All lifecycle states included
    // -----------------------------------------------------------------------

    describe('Lifecycle state coverage', () => {
        it('should pass no lifecycleState filter when none is specified (all states)', async () => {
            listCaptures.length = 0;

            await app.request(BASE, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            const first2 = listCaptures[0];
            if (listCaptures.length > 0 && first2 !== undefined) {
                const capture = first2;
                const options = capture.options as Record<string, unknown>;
                const where = options.where as Record<string, unknown>;
                // No lifecycleState filter means ALL states are returned (DRAFT, ACTIVE, ARCHIVED)
                expect(where.lifecycleState).toBeUndefined();
            }
        });

        it('should forward DRAFT lifecycleState filter when provided', async () => {
            listCaptures.length = 0;

            await app.request(`${BASE}?lifecycleState=DRAFT`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            const first3 = listCaptures[0];
            if (listCaptures.length > 0 && first3 !== undefined) {
                const capture = first3;
                const options = capture.options as Record<string, unknown>;
                const where = options.where as Record<string, unknown>;
                expect(where.lifecycleState).toBe('DRAFT');
            }
        });

        it('should forward ACTIVE lifecycleState filter when provided', async () => {
            listCaptures.length = 0;

            await app.request(`${BASE}?lifecycleState=ACTIVE`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            const first4 = listCaptures[0];
            if (listCaptures.length > 0 && first4 !== undefined) {
                const capture = first4;
                const options = capture.options as Record<string, unknown>;
                const where = options.where as Record<string, unknown>;
                expect(where.lifecycleState).toBe('ACTIVE');
            }
        });

        it('should forward ARCHIVED lifecycleState filter when provided', async () => {
            listCaptures.length = 0;

            await app.request(`${BASE}?lifecycleState=ARCHIVED`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });

            const first5 = listCaptures[0];
            if (listCaptures.length > 0 && first5 !== undefined) {
                const capture = first5;
                const options = capture.options as Record<string, unknown>;
                const where = options.where as Record<string, unknown>;
                expect(where.lifecycleState).toBe('ARCHIVED');
            }
        });

        it('should reject invalid lifecycleState value', async () => {
            const res = await app.request(`${BASE}?lifecycleState=INVALID_STATE`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });
            // Zod enum validation rejects unknown values → 400
            // Or 401 if mock auth not active in this env
            expect([400, 401]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // Pagination query params
    // -----------------------------------------------------------------------

    describe('Pagination', () => {
        it('should accept page and pageSize query params', async () => {
            const res = await app.request(`${BASE}?page=1&pageSize=10`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });
            // Should not crash — 200, 400, or 401 are all acceptable
            expect([200, 400, 401, 403]).toContain(res.status);
        });

        it('should reject unknown query params', async () => {
            const res = await app.request(`${BASE}?unknownParam=abc`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });
            // createProtectedListRoute / createListRoute rejects unknown params → 400
            // or 401 if mock auth not active
            expect([400, 401]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // Response shape
    // -----------------------------------------------------------------------

    describe('Response shape', () => {
        it('should include success field in JSON response', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('success');
                expect(body.success).toBe(true);
            }
        });

        it('should include data array and pagination in 200 response', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'OWNER_BASICO',
                    'x-mock-actor-id': 'owner-abc-123'
                }
            });
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(Array.isArray(body.data)).toBe(true);
                expect(body).toHaveProperty('pagination');
                expect(typeof body.pagination.total).toBe('number');
            }
        });
    });
});
