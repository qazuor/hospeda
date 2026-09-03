/**
 * Tests for the product-domain hydration on
 * GET /api/v1/protected/users/me/entitlements (HOS-934).
 *
 * `getByCustomerId()` never populates `productDomain` on the subscriptions it
 * returns (qzpay-core's mapper builds them field-by-field from the fields
 * `QZPaySubscription` declares — see `hydrateSubscriptionProductDomains`'s
 * doc in `@repo/service-core`). Without hydration, `isAccommodationSubscription`
 * sees `productDomain: undefined` on every row and matches ALL of them —
 * including a gastronomy-only owner's subscription — as if they were
 * accommodation, surfacing a commerce plan under the accommodation
 * entitlements response.
 *
 * The fixture below never sets `productDomain` directly, matching the real
 * SDK shape; `hydrateSubscriptionProductDomains` recovers it from the
 * mocked `getDb()` batched SELECT.
 *
 * @module test/routes/user/protected/entitlements-product-domain
 */

import { getDb } from '@repo/db';
import { isOwnerCategorySubscription, RoleEnum } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateProtectedRoute, mockGetQZPayBilling, mockGetActor } = vi.hoisted(() => ({
    mockCreateProtectedRoute: vi.fn(),
    mockGetQZPayBilling: vi.fn(),
    mockGetActor: vi.fn()
}));

vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: () => mockGetQZPayBilling()
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: mockCreateProtectedRoute
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: () => mockGetActor()
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import '../../../../src/routes/user/protected/entitlements';

type RouteConfig = { handler: (ctx: unknown) => Promise<unknown> };

const [entitlementsRouteConfig] = mockCreateProtectedRoute.mock.calls.map(
    (call) => call[0] as RouteConfig
);

const entitlementsHandler = entitlementsRouteConfig?.handler as (
    ctx: unknown
) => Promise<{ plan: { slug: string; name: string; status: string } | null }>;

function makeCtx(overrides: Record<string, unknown> = {}) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['userEntitlements', new Set<string>()],
        ['userLimits', new Map<string, number>()],
        ...Object.entries(overrides)
    ]);
    return {
        get: (key: string) => store.get(key),
        set: (key: string, val: unknown) => store.set(key, val)
    };
}

/** Builds a QZPay-shaped subscription row WITHOUT `productDomain` (HOS-934). */
function buildSubscription(input: { status: string; planId: string; id?: string }) {
    return { id: input.id ?? 'sub-1', status: input.status, planId: input.planId };
}

function setupBillingMock(sub: { status: string; planId: string; id?: string }) {
    mockGetQZPayBilling.mockReturnValue({
        customers: { getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
        subscriptions: { getByCustomerId: vi.fn().mockResolvedValue([sub]) },
        plans: { get: vi.fn().mockResolvedValue({ name: 'Gastronomy Plus' }) }
    });
}

/** Wires `getDb()` to answer the hydration recovery SELECT with `productDomain`. */
function mockStoredProductDomain(id: string, productDomain: string | null) {
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ id, productDomain }])
            })
        })
    } as never);
}

describe('GET /me/entitlements — productDomain hydration (HOS-934)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isOwnerCategorySubscription).mockResolvedValue(true);
    });

    it('does NOT surface a gastronomy-only subscription as the accommodation plan', async () => {
        mockGetActor.mockReturnValue({ id: 'user-1', roles: [RoleEnum.USER] });
        const sub = buildSubscription({
            id: 'sub-gastronomy',
            status: 'active',
            planId: 'plan-gastro'
        });
        setupBillingMock(sub);
        mockStoredProductDomain('sub-gastronomy', 'gastronomy');

        const result = await entitlementsHandler(makeCtx());

        // Without hydration this would resolve to the gastronomy plan under
        // the accommodation-scoped entitlements response — the HOS-934 bug.
        expect(result.plan).toBeNull();
    });

    it('(control) still surfaces a real accommodation subscription — the fix must not invert the bug', async () => {
        mockGetActor.mockReturnValue({ id: 'user-2', roles: [RoleEnum.USER] });
        const sub = buildSubscription({
            id: 'sub-accommodation',
            status: 'active',
            planId: 'plan-accommodation'
        });
        setupBillingMock(sub);
        mockStoredProductDomain('sub-accommodation', 'accommodation');

        const result = await entitlementsHandler(makeCtx());

        expect(result.plan).not.toBeNull();
        expect(result.plan?.status).toBe('active');
    });
});
