/**
 * SPEC-145 T-020 — Stale-cache canary: entitlement cache invalidation semantics
 *
 * This test PINS that the entitlement cache is the ONLY thing standing between a
 * lifecycle mutation and wrong access. It intentionally documents the failure mode
 * so that future refactors cannot silently remove the cache layer without this test
 * screaming.
 *
 * Test design (three-step canary):
 *
 *   Step 1: WARM — customer on owner-pro, hit a gated route → 200.
 *              Cache is now warm with the owner-pro entitlements.
 *
 *   Step 2: STALE — mutate the subscription in DB DIRECTLY to `cancelled` WITHOUT
 *              calling clearEntitlementCache. Hit the same gated route again → 200
 *              (stale serve from cache). This documents the failure mode: if the
 *              cache were not used, or if the middleware re-read from DB on every
 *              request, this step would already return 403. The fact that it still
 *              returns 200 proves the cache is the authoritative in-process gate.
 *
 *              INTENTIONAL: this is NOT a bug we are documenting as acceptable.
 *              Rather, this step proves that clearEntitlementCache() is the CRITICAL
 *              invariant that every lifecycle handler MUST call. If this assertion
 *              flips (step 2 starts returning 403 without a cache clear), it means
 *              either:
 *                (a) the middleware was changed to bypass the cache → must be updated
 *                    consciously after understanding the performance implications; OR
 *                (b) an accidental TTL expiry / cache eviction races with the test →
 *                    investigate the test environment, do not simply bump timeouts.
 *
 *   Step 3: INVALIDATE — call clearEntitlementCache(customerId) → same gated route
 *              → 403 ENTITLEMENT_REQUIRED. The cache was the bridge; removing it
 *              forces the middleware to re-read from DB which now shows `cancelled`.
 *
 * Route under test:
 *   POST /api/v1/protected/accommodations/draft  (requires PUBLISH_ACCOMMODATIONS)
 *
 * Plan under test: owner-pro (has PUBLISH_ACCOMMODATIONS).
 * After subscription cancellation: entitlement is gone → gate fires.
 *
 * @module test/e2e/flows/billing/enforcement-stale-cache
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter.
// The billing instance initializes an MP adapter at construction time; without
// the stub the constructor reaches for live MP credentials and throws.
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — enforcement-stale-cache.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { createMockActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// Initialize MP stub once; reset per test via mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Entitlement key
// ---------------------------------------------------------------------------

const E = {
    PUBLISH_ACCOMMODATIONS: 'publish_accommodations'
} as const;

// ---------------------------------------------------------------------------
// Actor helper
// ---------------------------------------------------------------------------

/**
 * Actor with the route-level ACCOMMODATION_CREATE permission so the permission
 * guard passes before the entitlement gate fires.
 */
function makeAccommodationCreateActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_CREATE
        ],
        userId
    );
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert the entitlement gate BLOCKED the request (403 ENTITLEMENT_REQUIRED).
 */
async function expectEntitlementBlock(res: Response): Promise<void> {
    expect(res.status, `expected 403 but got ${res.status}`).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
}

/**
 * Assert the entitlement gate PASSED (any status except 403 ENTITLEMENT_REQUIRED).
 * Returns the response status for further inspection.
 */
async function expectGatePassed(res: Response): Promise<number> {
    if (res.status === 403) {
        const body = (await res.clone().json()) as { error?: { code?: string } };
        expect(
            body?.error?.code,
            'Gate should have passed but got 403 ENTITLEMENT_REQUIRED'
        ).not.toBe('ENTITLEMENT_REQUIRED');
    }
    return res.status;
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-145 T-020 — stale-cache canary: clearEntitlementCache is the invariant', () => {
    let app: ReturnType<typeof initApp>;
    let ownerProPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        // owner-pro: has PUBLISH_ACCOMMODATIONS — the gate we are testing.
        const ownerPro = await createTestPlan({
            name: `StaleCacheCanary-OwnerPro-${randomUUID().slice(0, 8)}`,
            entitlements: [E.PUBLISH_ACCOMMODATIONS]
        });
        ownerProPlanId = ownerPro.planId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // The three-step canary.
    // =========================================================================

    it('warm → stale (200 without cache clear) → invalidate → 403: ' +
        'pins that cache is the only thing between a lifecycle bug and wrong access', async () => {
        // ── Arrange ─────────────────────────────────────────────────────────

        const user = await createTestUser({
            email: `stale-cache-canary-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        const sub = await createTestSubscription({
            customerId: customer.customerId,
            planId: ownerProPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            metadata: { source: 'stale-cache-canary-test' }
        });

        // Cold-start: ensure no pre-existing stale entry.
        clearEntitlementCache(customer.customerId);

        const actor = makeAccommodationCreateActor(user.id);
        const client = new E2EApiClient(app, actor);

        // Minimal valid draft body (name + summary + type are required by the Zod schema).
        const draftBody = {
            name: 'Stale Cache Canary Draft',
            summary: 'Test accommodation for stale cache canary',
            type: 'APARTMENT',
            destinationId: randomUUID() // FK will fail post-gate — that is acceptable
        };

        // ── Step 1: WARM — gate passes, cache is now warm ──────────────────

        const warmRes = await client.post('/api/v1/protected/accommodations/draft', draftBody);
        // The gate passes (PUBLISH_ACCOMMODATIONS is in owner-pro).
        // The handler may return 4xx for missing FK — irrelevant; we only care the
        // gate did NOT fire ENTITLEMENT_REQUIRED.
        await expectGatePassed(warmRes);

        // ── Step 2: STALE — mutate DB directly WITHOUT clearEntitlementCache ─
        //
        // This is the DOCUMENTED FAILURE MODE: the cache holds the owner-pro
        // entitlements even though the subscription is now cancelled in the DB.
        // The middleware reads the cache → returns the pre-mutation value → gate
        // STILL passes (200). This is exactly what happens when a lifecycle handler
        // forgets to call clearEntitlementCache.
        //
        // INTENTIONAL assertion: step 2 MUST return non-403 (stale serve).
        // If it returns 403 without a cache clear, the cache layer was removed or
        // the TTL is too short for this test — this change must be made consciously.

        await testDb.getDb().execute(sql`
                UPDATE billing_subscriptions
                   SET status = 'cancelled'
                 WHERE id = ${sub.subscriptionId}
            `);

        // Hit the same route WITHOUT clearing the cache.
        const staleRes = await client.post('/api/v1/protected/accommodations/draft', draftBody);
        // STALE SERVE: cache still has owner-pro entitlements → gate passes.
        // This assertion documents the failure mode: a lifecycle handler that skips
        // clearEntitlementCache would leave the customer with stale access.
        await expectGatePassed(staleRes);

        // ── Step 3: INVALIDATE — clear the cache → gate fires correctly ─────

        clearEntitlementCache(customer.customerId);

        const freshRes = await client.post('/api/v1/protected/accommodations/draft', draftBody);
        // After cache invalidation the middleware re-reads from the billing layer.
        // The subscription is cancelled → no active subscription → no entitlements
        // → ENTITLEMENT_REQUIRED 403.
        await expectEntitlementBlock(freshRes);
    });
});
