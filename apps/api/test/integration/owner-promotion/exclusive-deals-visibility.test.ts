/**
 * HOS-21 T-014: real-DB integration tests for
 * GET /api/v1/protected/owner-promotions/exclusive-deals.
 *
 * Unlike `test/routes/owner-promotion/protected/exclusive-deals.test.ts` and
 * `exclusive-deals-gate.test.ts` (which mock `@repo/service-core` entirely to
 * test route wiring in isolation), this suite exercises the REAL
 * `OwnerPromotionService.findExclusiveDeals` against a live database — the
 * only way to genuinely validate the tier-scoping SQL (T-005) and the
 * accommodation-visibility `EXISTS` subquery (T-006) end-to-end through HTTP.
 * `ownerPromotion.accommodation-visibility.test.ts`'s own header comment
 * defers this exact coverage to "the T-014 API integration tests against a
 * live database".
 *
 * Scenarios (per HOS-21 T-014 subtasks):
 *  - 401 for an unauthenticated caller (actorMiddleware rejects before the
 *    entitlement gate — matches the existing T-008 route test, NOT a 403;
 *    the task's original "403 ... for ... unauthenticated" premise doesn't
 *    match real route behavior, corrected here).
 *  - 403 ENTITLEMENT_REQUIRED for an authenticated free tourist (no billing
 *    subscription at all).
 *  - 200 with only 'plus'-tier items for a tourist-plus actor.
 *  - 200 with 'plus'+'vip' items for a tourist-vip actor.
 *  - A deal on an accommodation-visibility-restricted accommodation is
 *    excluded from BOTH tiers.
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter — the billing instance
// initialises a MercadoPago adapter at construction time even though these
// tests never exercise checkout/webhook flows (same pattern as
// enforcement-limits.test.ts).
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
                    'mp-stub adapter not initialized — exclusive-deals-visibility.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { accommodations, destinations, getDb, ownerPromotions } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import { resetBillingInstance } from '../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../src/middlewares/entitlement.js';
import { E2EApiClient } from '../../e2e/helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../e2e/helpers/billing-factories.js';
import { createMpStubAdapter } from '../../e2e/helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../e2e/setup/seed-helpers.js';
import { testDb } from '../../e2e/setup/test-database.js';
import { createMockActor } from '../../helpers/auth.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

const BASE = '/api/v1/protected/owner-promotions/exclusive-deals';

/** String entitlement-key constants — avoids entangling the @repo/billing mock. */
const E = {
    EXCLUSIVE_DEALS: 'exclusive_deals',
    VIP_PROMOTIONS_ACCESS: 'vip_promotions_access'
} as const;

function makeTouristActor(userId: string): Actor {
    return createMockActor(RoleEnum.USER, [PermissionEnum.ACCESS_API_PUBLIC], userId);
}

interface ExclusiveDealsItem {
    readonly title: string;
    readonly touristAudience: 'plus' | 'vip';
}

interface ExclusiveDealsBody {
    readonly success: boolean;
    readonly data?: { readonly items: readonly ExclusiveDealsItem[] };
    readonly error?: { readonly code: string };
}

describe('GET /owner-promotions/exclusive-deals — real-DB tier + visibility (HOS-21 T-014)', () => {
    let app: ReturnType<typeof initApp>;

    let touristPlusPlanId: string;
    let touristVipPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    // NOTE: deliberately no afterAll(testDb.teardown()) here. This folder's
    // sibling files (public.test.ts, public-endpoint.test.ts) do not manage
    // their own DB connection at all and depend on ambient state left behind
    // by whichever e2e file ran earlier in the same fork. Tearing down here
    // breaks public.test.ts's real-DB happy-path test when files run in the
    // same process in alphabetical order (verified locally — this file sorts
    // before public-endpoint/public.test.ts within the folder).

    beforeEach(async () => {
        mpStub.config.reset();

        const touristPlus = await createTestPlan({
            name: `HOS21-TouristPlus-${randomUUID().slice(0, 8)}`,
            entitlements: [E.EXCLUSIVE_DEALS]
        });
        touristPlusPlanId = touristPlus.planId;

        const touristVip = await createTestPlan({
            name: `HOS21-TouristVip-${randomUUID().slice(0, 8)}`,
            entitlements: [E.EXCLUSIVE_DEALS, E.VIP_PROMOTIONS_ACCESS]
        });
        touristVipPlanId = touristVip.planId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('returns 401 for an unauthenticated request', async () => {
        const res = await app.request(BASE, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(401);
    });

    it('returns 403 ENTITLEMENT_REQUIRED for an authenticated free tourist (no subscription)', async () => {
        const user = await createTestUser({
            email: `hos21-free-${randomUUID().slice(0, 8)}@example.com`
        });
        const actor = makeTouristActor(user.id);
        const client = new E2EApiClient(app, actor);

        const res = await client.get(BASE);

        expect(res.status).toBe(403);
        const body = (await res.json()) as ExclusiveDealsBody;
        expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
    });

    describe('tier scoping + accommodation-visibility exclusion', () => {
        /** Seeded fixture ids shared by the tier-scoping tests below. */
        let visibleAccommodationId: string;
        let restrictedAccommodationId: string;

        beforeEach(async () => {
            const db = getDb();
            const owner = await createTestUser({
                email: `hos21-owner-${randomUUID().slice(0, 8)}@example.com`
            });

            const destId = randomUUID();
            await db.insert(destinations).values({
                id: destId,
                destinationType: 'CITY',
                path: `/hos21-test-dest-${destId}`,
                slug: `hos21-test-dest-${destId}`,
                name: `HOS-21 Test Dest ${destId}`,
                summary: 'HOS-21 exclusive-deals visibility test destination',
                description: 'HOS-21 exclusive-deals visibility test destination description',
                location: { country: 'AR', state: 'ER', city: 'CDU' }
            } as typeof destinations.$inferInsert);

            const visibleInserted = await db
                .insert(accommodations)
                .values({
                    slug: `hos21-visible-accom-${randomUUID().slice(0, 8)}`,
                    name: 'HOS-21 Visible Accommodation',
                    summary: 'Visible',
                    type: 'APARTMENT',
                    description: 'Factory-inserted, publicly visible accommodation',
                    ownerId: owner.id,
                    destinationId: destId
                    // visibility/ownerSuspended/planRestricted/lifecycleState left
                    // at their PUBLIC/false/false/ACTIVE defaults.
                } as typeof accommodations.$inferInsert)
                .returning({ id: accommodations.id });
            visibleAccommodationId = visibleInserted[0]?.id as string;

            const restrictedInserted = await db
                .insert(accommodations)
                .values({
                    slug: `hos21-restricted-accom-${randomUUID().slice(0, 8)}`,
                    name: 'HOS-21 Restricted Accommodation',
                    summary: 'Restricted',
                    type: 'APARTMENT',
                    description: 'Factory-inserted, visibility-restricted accommodation',
                    ownerId: owner.id,
                    destinationId: destId,
                    visibility: 'RESTRICTED'
                } as typeof accommodations.$inferInsert)
                .returning({ id: accommodations.id });
            restrictedAccommodationId = restrictedInserted[0]?.id as string;

            const validFrom = new Date(Date.now() - 86400000); // yesterday — currently valid

            await db.insert(ownerPromotions).values([
                {
                    slug: `hos21-plus-visible-${randomUUID().slice(0, 8)}`,
                    ownerId: owner.id,
                    accommodationId: visibleAccommodationId,
                    title: 'Plus deal on visible accommodation',
                    discountType: 'percentage',
                    discountValue: 10,
                    validFrom,
                    touristAudience: 'plus'
                },
                {
                    slug: `hos21-vip-visible-${randomUUID().slice(0, 8)}`,
                    ownerId: owner.id,
                    accommodationId: visibleAccommodationId,
                    title: 'Vip deal on visible accommodation',
                    discountType: 'percentage',
                    discountValue: 20,
                    validFrom,
                    touristAudience: 'vip'
                },
                {
                    slug: `hos21-plus-restricted-${randomUUID().slice(0, 8)}`,
                    ownerId: owner.id,
                    accommodationId: restrictedAccommodationId,
                    title: 'Plus deal on restricted accommodation',
                    discountType: 'percentage',
                    discountValue: 10,
                    validFrom,
                    touristAudience: 'plus'
                },
                {
                    slug: `hos21-vip-restricted-${randomUUID().slice(0, 8)}`,
                    ownerId: owner.id,
                    accommodationId: restrictedAccommodationId,
                    title: 'Vip deal on restricted accommodation',
                    discountType: 'percentage',
                    discountValue: 20,
                    validFrom,
                    touristAudience: 'vip'
                }
            ] as (typeof ownerPromotions.$inferInsert)[]);
        });

        it('returns only plus-tier items for a tourist-plus actor, excluding the restricted-accommodation deal', async () => {
            const tourist = await createTestUser({
                email: `hos21-plus-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({ externalId: tourist.id });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: touristPlusPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeTouristActor(tourist.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get(BASE);

            expect(res.status).toBe(200);
            const body = (await res.json()) as ExclusiveDealsBody;
            const titles = (body.data?.items ?? []).map((i) => i.title);

            expect(titles).toContain('Plus deal on visible accommodation');
            expect(titles).not.toContain('Vip deal on visible accommodation');
            expect(titles).not.toContain('Plus deal on restricted accommodation');
            expect(titles).not.toContain('Vip deal on restricted accommodation');
        });

        it('returns plus + vip items for a tourist-vip actor, excluding the restricted-accommodation deals', async () => {
            const tourist = await createTestUser({
                email: `hos21-vip-${randomUUID().slice(0, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({ externalId: tourist.id });
            await createTestSubscription({
                customerId: customer.customerId,
                planId: touristVipPlanId,
                status: 'active'
            });
            clearEntitlementCache(customer.customerId);

            const actor = makeTouristActor(tourist.id);
            const client = new E2EApiClient(app, actor);

            const res = await client.get(BASE);

            expect(res.status).toBe(200);
            const body = (await res.json()) as ExclusiveDealsBody;
            const titles = (body.data?.items ?? []).map((i) => i.title);

            expect(titles).toContain('Plus deal on visible accommodation');
            expect(titles).toContain('Vip deal on visible accommodation');
            expect(titles).not.toContain('Plus deal on restricted accommodation');
            expect(titles).not.toContain('Vip deal on restricted accommodation');
        });
    });
});
