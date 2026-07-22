/**
 * Tests for GET /api/v1/protected/users/me/entitlements plan-context resolution
 * for comp (SPEC-262 complimentary) subscriptions — HOS-239.
 *
 * Before HOS-239 the route re-implemented its own "find active sub" with an
 * `active | trialing` filter that dropped `comp`, so `plan` came back `null`
 * for every comped subscriber even though their entitlements/limits (sourced
 * from the entitlement middleware) were correct. This exercises the fixed
 * plan-context resolution directly by invoking the captured route handler.
 *
 * @module test/routes/user/protected/entitlements-comp
 */

import { isOwnerCategorySubscription, RoleEnum } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Import trigger — AFTER all vi.mock declarations
// ---------------------------------------------------------------------------

import '../../../../src/routes/user/protected/entitlements';

// ---------------------------------------------------------------------------
// Capture handler from the mocked route factory
// ---------------------------------------------------------------------------

type RouteConfig = { handler: (ctx: unknown) => Promise<unknown> };

const [entitlementsRouteConfig] = mockCreateProtectedRoute.mock.calls.map(
    (call) => call[0] as RouteConfig
);

const entitlementsHandler = entitlementsRouteConfig?.handler as (
    ctx: unknown
) => Promise<{ plan: { slug: string; name: string; status: string } | null }>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function setupBillingMock(sub: { status: string; planId: string }) {
    mockGetQZPayBilling.mockReturnValue({
        customers: { getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
        subscriptions: { getByCustomerId: vi.fn().mockResolvedValue([sub]) },
        plans: { get: vi.fn().mockResolvedValue({ name: 'Plus' }) }
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /me/entitlements — comp plan context (HOS-239)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isOwnerCategorySubscription).mockResolvedValue(true);
    });

    it('resolves plan (not null) for a comp subscriber — regression', async () => {
        // A non-HOST comp subscriber: before the fix the find dropped `comp`
        // and `plan` came back null.
        mockGetActor.mockReturnValue({ id: 'user-1', role: RoleEnum.USER });
        setupBillingMock({ status: 'comp', planId: 'plan-tourist-plus' });

        const result = await entitlementsHandler(makeCtx());

        expect(result.plan).not.toBeNull();
        expect(result.plan?.name).toBe('Plus');
        expect(result.plan?.status).toBe('comp');
    });

    it('resolves plan for a HOST comped on a tourist plan (comp exempt from HOS-217 discard)', async () => {
        // HOST + tourist-category comp: the discard would normally fire
        // (isOwnerCategorySubscription=false) but the comp exemption keeps the
        // plan resolved — and short-circuits before the category check.
        mockGetActor.mockReturnValue({ id: 'host-1', role: RoleEnum.HOST });
        vi.mocked(isOwnerCategorySubscription).mockResolvedValue(false);
        setupBillingMock({ status: 'comp', planId: 'plan-tourist-plus' });

        const result = await entitlementsHandler(makeCtx());

        expect(result.plan).not.toBeNull();
        expect(result.plan?.status).toBe('comp');
        expect(isOwnerCategorySubscription).not.toHaveBeenCalled();
    });

    it('still discards a HOST active tourist sub (HOS-217 unchanged) → plan null', async () => {
        mockGetActor.mockReturnValue({ id: 'host-2', role: RoleEnum.HOST });
        vi.mocked(isOwnerCategorySubscription).mockResolvedValue(false);
        setupBillingMock({ status: 'active', planId: 'plan-tourist-vip' });

        const result = await entitlementsHandler(makeCtx());

        expect(result.plan).toBeNull();
        expect(isOwnerCategorySubscription).toHaveBeenCalledWith(
            expect.objectContaining({ planId: 'plan-tourist-vip' })
        );
    });
});
