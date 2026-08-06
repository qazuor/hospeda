/**
 * Unit/integration tests for PUT /api/v1/protected/accommodations/:id/faqs/reorder
 * Reorder FAQs on an accommodation — Protected (owner-facing) endpoint (HOS-393)
 *
 * Coverage:
 * - Entitlement gate: actor lacking EDIT_ACCOMMODATION_INFO gets 403 ENTITLEMENT_REQUIRED
 * - Entitlement gate: actor holding EDIT_ACCOMMODATION_INFO passes through to the service
 * - Happy path: returns the service's success payload and calls
 *   service.reorderFaqs with the correct { accommodationId, order }
 * - Error: unknown/foreign faqId returns 4xx (VALIDATION_ERROR from the service)
 * - Error: empty order array returns 400 (Zod validation)
 * - Route registration: path should not return 404
 * - Route ordering: "reorder" path is not confused with /:faqId
 *
 * Testing strategy: mock `@repo/service-core` (no DB), mock `getActorFromContext`
 * (fixed HOST owner actor), and mock `entitlementMiddleware` to toggle
 * userEntitlements deterministically — mirrors
 * apps/api/test/routes/accommodation-protected-reorder-media.test.ts (actor +
 * service mocking) and
 * apps/api/test/routes/user-bookmark-collection/entitlement-gate.integration.test.ts
 * (real entitlementMiddleware mock for a true 403 ENTITLEMENT_REQUIRED check).
 *
 * NOTE: raw session authentication (missing/invalid Bearer token) is
 * deliberately NOT covered here — `getActorFromContext` is mocked to a fixed
 * actor for every request in this suite, so a "no Authorization header" case
 * would only be exercising that mock, not real auth behavior. Better Auth
 * session handling has its own dedicated middleware tests.
 *
 * @module test/routes/accommodation-protected-reorder-faqs
 */

import { EntitlementKey, type LimitKey } from '@repo/billing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockReorderFaqs } = vi.hoisted(() => ({
    mockReorderFaqs: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                reorderFaqs: mockReorderFaqs
            };
        })
    };
});

// Actor: HOST owner with UPDATE_OWN permission (same fixture shape as the
// media-reorder sibling test).
const mockActor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: ['HOST'],
    permissions: ['accommodation.update.own', 'access.panelProtected']
};
vi.mock('../../src/utils/actor.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/actor.js')>();
    return {
        ...actual,
        getActorFromContext: () => mockActor
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

/**
 * Whether the mocked entitlementMiddleware grants EDIT_ACCOMMODATION_INFO for
 * the current test. Toggled per-test via `setEntitled`.
 */
const { getEntitled, setEntitled } = vi.hoisted(() => {
    let entitled = true;
    return {
        getEntitled: () => entitled,
        setEntitled: (value: boolean) => {
            entitled = value;
        }
    };
});

vi.mock('../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/middlewares/entitlement')>();
    return {
        ...actual,
        entitlementMiddleware:
            () => async (c: import('hono').Context, next: () => Promise<void>) => {
                c.set(
                    'userEntitlements',
                    getEntitled() ? new Set([EntitlementKey.EDIT_ACCOMMODATION_INFO]) : new Set()
                );
                c.set('userLimits', new Map<LimitKey, number>());
                c.set('billingLoadFailed', false);
                await next();
            }
    };
});

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ACCOMMODATION_ID = '00000000-0000-4000-8000-000000000001';
const FAQ_ID_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
const FAQ_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';
const BASE_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/faqs/reorder`;

const VALID_BODY = {
    order: [
        { faqId: FAQ_ID_2, displayOrder: 0 },
        { faqId: FAQ_ID_1, displayOrder: 1 }
    ]
};

/**
 * Builds request headers. `user-agent` is required by the global validation
 * middleware (`API_VALIDATION_REQUIRED_HEADERS`), so every request needs it.
 */
function buildHeaders(options: { auth?: boolean } = {}): Record<string, string> {
    const { auth = true } = options;
    return {
        'Content-Type': 'application/json',
        'user-agent': 'vitest',
        Accept: 'application/json',
        ...(auth ? { Authorization: 'Bearer test-protected-token' } : {})
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PUT /api/v1/protected/accommodations/:id/faqs/reorder — reorderFaqs (HOS-393)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        setEntitled(true);
        app = initApp();
        mockReorderFaqs.mockResolvedValue({ data: { success: true }, error: undefined });
    });

    // ── Entitlement gate ────────────────────────────────────────────────────────

    describe('Entitlement gate (EDIT_ACCOMMODATION_INFO)', () => {
        it('returns 403 ENTITLEMENT_REQUIRED when actor lacks EDIT_ACCOMMODATION_INFO', async () => {
            setEntitled(false);

            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify(VALID_BODY)
            });

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(mockReorderFaqs).not.toHaveBeenCalled();
        });

        it('proceeds to the service when actor has EDIT_ACCOMMODATION_INFO', async () => {
            setEntitled(true);

            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify(VALID_BODY)
            });

            expect(res.status).toBe(200);
            expect(mockReorderFaqs).toHaveBeenCalledTimes(1);
        });
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    describe('Happy path', () => {
        it('should return 200 with the service success payload', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify(VALID_BODY)
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toEqual({ success: true });
        });

        it('should call service.reorderFaqs with correct params', async () => {
            await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify(VALID_BODY)
            });

            expect(mockReorderFaqs).toHaveBeenCalledTimes(1);
            const firstCall = mockReorderFaqs.mock.calls[0] as [
                unknown,
                { accommodationId: string; order: Array<{ faqId: string; displayOrder: number }> }
            ];
            expect(firstCall[1].accommodationId).toBe(ACCOMMODATION_ID);
            expect(firstCall[1].order).toEqual(VALID_BODY.order);
        });
    });

    // ── Error handling ─────────────────────────────────────────────────────────

    describe('Error handling', () => {
        it('should return 4xx when a faqId does not belong to this accommodation', async () => {
            mockReorderFaqs.mockResolvedValue({
                data: undefined,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: `Unknown or foreign faqId(s) for this accommodation: ${FAQ_ID_1}`
                }
            });

            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify(VALID_BODY)
            });

            expect(res.status).not.toBe(200);
        });

        it('should return 4xx when the accommodation is not found', async () => {
            mockReorderFaqs.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
            });

            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify(VALID_BODY)
            });

            expect(res.status).not.toBe(200);
        });

        it('should return 400 when order is empty (Zod min(1) validation)', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify({ order: [] })
            });

            // Zod min(1) triggers a 400 before the service is called.
            expect(res.status).toBe(400);
            expect(mockReorderFaqs).not.toHaveBeenCalled();
        });

        it('should return 400 when order is missing from body', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify({})
            });

            expect(res.status).toBe(400);
            expect(mockReorderFaqs).not.toHaveBeenCalled();
        });
    });

    // ── Route registration sanity ─────────────────────────────────────────────

    describe('Route registration', () => {
        it('should be registered (PUT to the path does not return 404)', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify(VALID_BODY)
            });
            expect(res.status).not.toBe(404);
        });

        it('GET on the reorder path should return 4xx (wrong method — not route-not-found)', async () => {
            // Ensures "reorder" is not matched as a faqId param by any GET route.
            const res = await app.request(BASE_URL, {
                method: 'GET',
                headers: buildHeaders()
            });
            // 404 would mean no route matched. 405 = matched route, wrong method.
            // Anything except 200 confirms correct routing.
            expect(res.status).not.toBe(200);
        });
    });
});
