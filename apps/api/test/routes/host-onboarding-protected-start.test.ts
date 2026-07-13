/**
 * Regression test for HOS-152: entitlement-cache invalidation on
 * POST /api/v1/protected/host-onboarding/start.
 *
 * Context: this same request runs the global `entitlementMiddleware` BEFORE
 * the handler promotes the actor USER -> HOST. That middleware caches the
 * pre-promotion (tourist-free) entitlement set for the actor's billing
 * customer id. Without invalidating that cache, the host's very next request
 * (e.g. PATCH /protected/accommodations/:id) would read the stale set and
 * 403 for up to 5 minutes — the exact bug this fix addresses. The route
 * handler (`apps/api/src/routes/host-onboarding/protected/start.ts`) calls
 * `clearEntitlementCache(customerId)` right after `ensureCustomerExists`
 * resolves a customer id.
 *
 * Coverage:
 * - Happy path: `clearEntitlementCache` is called exactly once with the
 *   billing customer id resolved by `BillingCustomerSyncService`. This is
 *   the decisive regression guard — removing the `clearEntitlementCache`
 *   call from the route (or reverting the fix) makes this assertion fail.
 * - Negative: when no billing customer id is resolved (billing disabled /
 *   sync failure), `clearEntitlementCache` must NOT be called.
 *
 * Testing strategy: mirrors `accommodation-protected-publish.test.ts` — mock
 * `@repo/service-core` so no DB is needed for `AccommodationService`, mock
 * `BillingCustomerSyncService` so the customer-id resolution is deterministic,
 * and mock `clearEntitlementCache` itself (spread the rest of the real
 * `middlewares/entitlement` module so `entitlementMiddleware` used globally
 * by `createApp()` keeps working) to assert the exact invocation.
 *
 * @module test/routes/host-onboarding-protected-start
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockCreateForOnboarding, mockCount, mockEnsureCustomerExists, mockClearEntitlementCache } =
    vi.hoisted(() => ({
        mockCreateForOnboarding: vi.fn(),
        mockCount: vi.fn(),
        mockEnsureCustomerExists: vi.fn(),
        mockClearEntitlementCache: vi.fn()
    }));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                createForOnboarding: mockCreateForOnboarding,
                // `enforceAccommodationLimit({ skipWhenActiveDraftExists: true })`
                // (wired on this route) instantiates its own AccommodationService
                // and calls `.count()` twice (draft-exists bypass check, then the
                // general MAX_ACCOMMODATIONS check) before the handler ever runs.
                count: mockCount
            };
        })
    };
});

vi.mock('../../src/services/billing-customer-sync.js', () => ({
    BillingCustomerSyncService: vi.fn().mockImplementation(function () {
        return {
            ensureCustomerExists: mockEnsureCustomerExists
        };
    })
}));

vi.mock('../../src/middlewares/entitlement.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/middlewares/entitlement.js')>();
    return {
        ...actual,
        clearEntitlementCache: mockClearEntitlementCache
    };
});

// Actor: authenticated USER being promoted to HOST by this route.
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mockActor = {
    id: ACTOR_ID,
    email: 'host-candidate@example.com',
    name: 'Host Candidate',
    role: 'USER',
    permissions: []
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

// ---------------------------------------------------------------------------
// Import app AFTER mocks are set up
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BASE_URL = '/api/v1/protected/host-onboarding/start';
const ACCOMMODATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CUSTOMER_ID = 'cus_test_promoted_1234567890';

const VALID_BODY = {
    name: 'Cabaña de prueba',
    summary: 'A lovely test cabin used only for this regression test.',
    type: 'HOTEL',
    destinationId: '11111111-1111-4111-8111-111111111111'
};

const REQUEST_HEADERS = {
    Authorization: 'Bearer test-protected-token',
    'User-Agent': 'vitest',
    'Content-Type': 'application/json'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/v1/protected/host-onboarding/start — entitlement cache invalidation (HOS-152)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();

        mockCount.mockResolvedValue({ data: { count: 0 }, error: undefined });
        mockCreateForOnboarding.mockResolvedValue({
            data: {
                status: 'created',
                accommodation: {
                    id: ACCOMMODATION_ID,
                    slug: 'cabana-de-prueba'
                }
            },
            error: undefined
        });
        mockEnsureCustomerExists.mockResolvedValue(CUSTOMER_ID);
    });

    it('clears the entitlement cache for the promoted customer after a successful onboarding start', async () => {
        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: REQUEST_HEADERS,
            body: JSON.stringify(VALID_BODY)
        });

        expect(res.status).toBe(201);
        // Decisive regression guard: this is the exact call HOS-152 added.
        // Deleting `clearEntitlementCache(customerId)` from the route (or
        // reverting the fix) makes this assertion fail.
        expect(mockClearEntitlementCache).toHaveBeenCalledTimes(1);
        expect(mockClearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('does not clear the entitlement cache when no billing customer id is resolved', async () => {
        mockEnsureCustomerExists.mockResolvedValue(null);

        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: REQUEST_HEADERS,
            body: JSON.stringify(VALID_BODY)
        });

        expect(res.status).toBe(201);
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });
});
