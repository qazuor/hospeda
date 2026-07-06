/**
 * SPEC-291 Phase 3b — `resolveOwnerEntitlementsForOwnerIds` unit tests.
 *
 * Tests the batch variant of `resolveOwnerEntitlementsForOwnerId` that powers
 * the `isVerified` badge gate on accommodation listing endpoints. Key contracts:
 *
 *   1. Returns a Map keyed by ownerId → entitlement array.
 *   2. ONE DB query for role lookups (asserted via mock call count).
 *   3. Parallel billing calls per non-staff owner.
 *   4. Staff owners receive the unlimited entitlement set (INV-6).
 *   5. Owners with no active subscription receive an empty array.
 *   6. Cache-cold resolution errors → fail-open with empty array for that owner.
 *   7. Batch DB query failure → fail-open with empty arrays for all owners.
 *   8. Second call with the same owner ID hits the cache (no second DB query).
 *
 * All assertions are UNCONDITIONAL — no conditional guards around expects.
 *
 * @module test/middlewares/owner-entitlement-batch
 */

import { EntitlementKey, getUnlimitedEntitlements } from '@repo/billing';
import { RoleEnum } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { resolveOwnerEntitlementsForOwnerIds } from '../../src/middlewares/owner-entitlement';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock the DB module. The batch resolver uses:
//   db.select({ id: users.id, role: users.role })
//     .from(users)
//     .where(inArray(users.id, missing))
// No `.limit()` — the chain ends at `.where()` which returns a promise.
const mockSelect = vi.fn();
vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ select: mockSelect })),
    accommodations: { id: 'accommodations.id', ownerId: 'accommodations.ownerId' },
    users: { id: 'users.id', role: 'users.role' }
}));

// Mock PlanService (used by resolveOwnerLimitsForOwnerId, which is in the same
// module — we need it not to throw on import).
vi.mock('../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(function () {
        return {
            getBySlug: vi.fn()
        };
    })
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chainable Drizzle mock that returns `rows` when `.where()` resolves. */
function mockDbSelectReturning(rows: Array<{ id: string; role: RoleEnum | null }>) {
    const whereChain = { where: vi.fn().mockResolvedValue(rows) };
    const fromChain = { from: vi.fn().mockReturnValue(whereChain) };
    mockSelect.mockReturnValue(fromChain);
    return { fromChain, whereChain };
}

/** Build a minimal billing mock for the given customer/plan/entitlements. */
function buildBillingMock(
    customerId: string,
    planEntitlements: EntitlementKey[],
    status: 'active' | 'trialing' | 'inactive' = 'active'
) {
    const sub = status === 'inactive' ? [] : [{ id: 'sub-001', status, planId: 'plan-001' }];
    return {
        customers: {
            getByExternalId: vi.fn().mockResolvedValue({ id: customerId })
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(sub)
        },
        plans: {
            get: vi
                .fn()
                .mockResolvedValue(
                    sub.length > 0
                        ? { id: 'plan-001', entitlements: planEntitlements, limits: {} }
                        : null
                )
        },
        limits: { getByCustomerId: vi.fn().mockResolvedValue([]) },
        entitlements: { getByCustomerId: vi.fn().mockResolvedValue([]) }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveOwnerEntitlementsForOwnerIds', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns an empty map for an empty ownerIds array (no DB query)', async () => {
        const result = await resolveOwnerEntitlementsForOwnerIds([]);

        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('resolves a single owner with an active subscription having HAS_VERIFICATION_BADGE', async () => {
        const ownerId = 'owner-aaa1';
        const { whereChain } = mockDbSelectReturning([{ id: ownerId, role: RoleEnum.HOST }]);

        const billing = buildBillingMock('cust-001', [EntitlementKey.HAS_VERIFICATION_BADGE]);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await resolveOwnerEntitlementsForOwnerIds([ownerId]);

        expect(result.size).toBe(1);
        expect(result.get(ownerId)).toContain(EntitlementKey.HAS_VERIFICATION_BADGE);
        // ONE DB query for role lookup
        expect(mockSelect).toHaveBeenCalledTimes(1);
        expect(whereChain.where).toHaveBeenCalledTimes(1);
    });

    it('resolves multiple owners in ONE DB query (batch role lookup)', async () => {
        const ownerA = 'owner-batch-a';
        const ownerB = 'owner-batch-b';

        const { whereChain } = mockDbSelectReturning([
            { id: ownerA, role: RoleEnum.HOST },
            { id: ownerB, role: RoleEnum.HOST }
        ]);

        const billing = buildBillingMock('cust-ab', [EntitlementKey.HAS_VERIFICATION_BADGE]);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await resolveOwnerEntitlementsForOwnerIds([ownerA, ownerB]);

        // Both owners resolved
        expect(result.has(ownerA)).toBe(true);
        expect(result.has(ownerB)).toBe(true);
        // Critically: only ONE select call (not one per owner)
        expect(mockSelect).toHaveBeenCalledTimes(1);
        expect(whereChain.where).toHaveBeenCalledTimes(1);
    });

    it('returns empty array for an owner with no active subscription', async () => {
        const ownerId = 'owner-no-sub';
        mockDbSelectReturning([{ id: ownerId, role: RoleEnum.HOST }]);

        const billing = buildBillingMock('cust-no-sub', [], 'inactive');
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await resolveOwnerEntitlementsForOwnerIds([ownerId]);

        expect(result.has(ownerId)).toBe(true);
        expect(result.get(ownerId)).toEqual([]);
    });

    it('returns empty array when billing customer is not found for an owner', async () => {
        const ownerId = 'owner-no-customer';
        mockDbSelectReturning([{ id: ownerId, role: RoleEnum.HOST }]);

        const billing = {
            customers: { getByExternalId: vi.fn().mockResolvedValue(null) },
            subscriptions: { getByCustomerId: vi.fn() },
            plans: { get: vi.fn() },
            limits: { getByCustomerId: vi.fn() },
            entitlements: { getByCustomerId: vi.fn() }
        };
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await resolveOwnerEntitlementsForOwnerIds([ownerId]);

        expect(result.has(ownerId)).toBe(true);
        expect(result.get(ownerId)).toEqual([]);
    });

    it('grants the full unlimited set for a STAFF owner (INV-6 bypass)', async () => {
        const staffOwner = 'owner-admin-staff';
        mockDbSelectReturning([{ id: staffOwner, role: RoleEnum.ADMIN }]);

        // Billing should NOT be called for staff (staff bypass short-circuits)
        const billing = buildBillingMock('cust-staff', []);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await resolveOwnerEntitlementsForOwnerIds([staffOwner]);

        expect(result.has(staffOwner)).toBe(true);
        const unlimitedKeys = getUnlimitedEntitlements().entitlements;
        const resolvedKeys = result.get(staffOwner) ?? [];
        // Staff get the full unlimited set — at minimum it includes HAS_VERIFICATION_BADGE
        expect(resolvedKeys).toContain(EntitlementKey.HAS_VERIFICATION_BADGE);
        // Billing should not have been consulted for a staff owner
        expect(billing.customers.getByExternalId).not.toHaveBeenCalled();
        // The result should include all unlimited keys
        for (const key of unlimitedKeys) {
            expect(resolvedKeys).toContain(key);
        }
    });

    it('fails open with empty arrays for ALL owners when the batch DB query throws', async () => {
        const ownerA = 'owner-db-fail-a';
        const ownerB = 'owner-db-fail-b';

        // Make the DB query throw
        const fromChain = {
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockRejectedValue(new Error('DB connection lost'))
            })
        };
        mockSelect.mockReturnValue(fromChain);

        const billing = buildBillingMock('cust-x', [EntitlementKey.HAS_VERIFICATION_BADGE]);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await resolveOwnerEntitlementsForOwnerIds([ownerA, ownerB]);

        // Both owners in result with empty arrays
        expect(result.has(ownerA)).toBe(true);
        expect(result.has(ownerB)).toBe(true);
        expect(result.get(ownerA)).toEqual([]);
        expect(result.get(ownerB)).toEqual([]);
    });

    it('fails open with empty array for a specific owner when billing throws for that owner', async () => {
        const ownerGood = 'owner-billing-ok';
        const ownerBad = 'owner-billing-fail';

        mockDbSelectReturning([
            { id: ownerGood, role: RoleEnum.HOST },
            { id: ownerBad, role: RoleEnum.HOST }
        ]);

        const billing = {
            customers: {
                getByExternalId: vi.fn().mockImplementation(async (id: string) => {
                    if (id === ownerBad) throw new Error('Billing timeout');
                    return { id: `cust-for-${id}` };
                })
            },
            subscriptions: {
                getByCustomerId: vi
                    .fn()
                    .mockResolvedValue([{ id: 'sub-001', status: 'active', planId: 'plan-001' }])
            },
            plans: {
                get: vi.fn().mockResolvedValue({
                    id: 'plan-001',
                    entitlements: [EntitlementKey.HAS_VERIFICATION_BADGE],
                    limits: {}
                })
            },
            limits: { getByCustomerId: vi.fn().mockResolvedValue([]) },
            entitlements: { getByCustomerId: vi.fn().mockResolvedValue([]) }
        };
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await resolveOwnerEntitlementsForOwnerIds([ownerGood, ownerBad]);

        // Good owner resolved correctly
        expect(result.has(ownerGood)).toBe(true);
        expect(result.get(ownerGood)).toContain(EntitlementKey.HAS_VERIFICATION_BADGE);
        // Bad owner fails open with empty array
        expect(result.has(ownerBad)).toBe(true);
        expect(result.get(ownerBad)).toEqual([]);
    });

    it('deduplicates duplicate ownerIds so each is resolved only once', async () => {
        const ownerId = 'owner-dup';

        const { whereChain } = mockDbSelectReturning([{ id: ownerId, role: RoleEnum.HOST }]);

        const billing = buildBillingMock('cust-dup', [EntitlementKey.HAS_VERIFICATION_BADGE]);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await resolveOwnerEntitlementsForOwnerIds([ownerId, ownerId, ownerId]);

        expect(result.has(ownerId)).toBe(true);
        expect(result.get(ownerId)).toContain(EntitlementKey.HAS_VERIFICATION_BADGE);
        // Only one DB query despite three input copies
        expect(mockSelect).toHaveBeenCalledTimes(1);
        expect(whereChain.where).toHaveBeenCalledTimes(1);
        // Only one billing call per owner
        expect(billing.customers.getByExternalId).toHaveBeenCalledTimes(1);
    });
});

/**
 * Cache contract test.
 *
 * The per-owner badge cache (5-minute TTL, FIFO eviction at 2000 entries) must
 * serve cache hits without triggering a second DB query. This test runs in a
 * separate describe block because it depends on cache state from the first call,
 * which is not cleared between tests in the same describe block.
 *
 * NOTE: The cache state persists across ALL tests in the same module (module-level
 * Map). To keep tests isolated from each other, each test in the batch describe
 * above uses distinct ownerIds that won't collide with the cache-contract test
 * below (which uses a dedicated 'owner-cache-hit' id).
 */
describe('resolveOwnerEntitlementsForOwnerIds — cache behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('serves a second call for the same ownerId from cache (no second DB query)', async () => {
        const ownerId = 'owner-cache-hit-unique';

        // First call — populates cache
        mockDbSelectReturning([{ id: ownerId, role: RoleEnum.HOST }]);
        const billing = buildBillingMock('cust-cache', [EntitlementKey.HAS_VERIFICATION_BADGE]);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const first = await resolveOwnerEntitlementsForOwnerIds([ownerId]);

        expect(first.get(ownerId)).toContain(EntitlementKey.HAS_VERIFICATION_BADGE);
        expect(mockSelect).toHaveBeenCalledTimes(1);

        // Second call — should hit cache, no DB query
        vi.clearAllMocks();

        const second = await resolveOwnerEntitlementsForOwnerIds([ownerId]);

        expect(second.get(ownerId)).toContain(EntitlementKey.HAS_VERIFICATION_BADGE);
        expect(mockSelect).not.toHaveBeenCalled();
    });
});
