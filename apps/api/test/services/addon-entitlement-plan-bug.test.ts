/**
 * Regression tests for addon-entitlement.service.ts plan-resolve bug (SPEC-192 T-025)
 *
 * BUG: `applyAddonEntitlements` resolved the base plan limit by calling
 * `ALL_PLANS.find(p => p.slug === activeSubscription.planId)`. After SPEC-168
 * the `planId` stored in a QZPay subscription may be a `billing_plans` UUID
 * (for new rows) or a slug (for legacy rows). When `planId` is a UUID, the
 * `Array.find` always returns `undefined`, so `basePlanLimit` silently falls to
 * 0, and the addon limit is set to `0 + addonIncrement` instead of the real
 * plan base + increment.
 *
 * FIX: resolve via `PlanService.getById(planId)` first; on NOT_FOUND (or when
 * the value is clearly not a UUID) fall back to `PlanService.getBySlug(planId)`.
 * The DB response's `limits` field is `Record<string, number>`, so the key
 * lookup is a plain `limits[limitKey]` rather than `limits.find(...)`.
 *
 * This file verifies:
 * (a) UUID planId → `getById` resolves the plan → REAL base limit used
 * (b) Slug planId → `getBySlug` resolves the plan → REAL base limit used (legacy compat)
 * (c) Plan truly not found (both getById + getBySlug fail) → falls back to
 *     base 0 and logs a warning (minimal safe behaviour preserved)
 *
 * No real database. All external calls are mocked.
 *
 * @module test/services/addon-entitlement-plan-bug.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockCatalogGetBySlug, mockPlanGetById, mockPlanGetBySlug, mockWarn } = vi.hoisted(() => ({
    mockCatalogGetBySlug: vi.fn(),
    mockPlanGetById: vi.fn(),
    mockPlanGetBySlug: vi.fn(),
    mockWarn: vi.fn()
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

// PlanService and AddonCatalogService come from @repo/service-core
vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockCatalogGetBySlug,
        list: vi.fn()
    })),
    PlanService: vi.fn().mockImplementation(() => ({
        getById: mockPlanGetById,
        getBySlug: mockPlanGetBySlug
    }))
}));

// ALL_PLANS is NOT used after the fix — mock it with an intentionally empty
// array so that any remaining ALL_PLANS.find() calls return undefined and the
// tests would catch a regression if the old code path is still hit.
vi.mock('@repo/billing', () => ({
    ALL_PLANS: []
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([])
            })
        })
    })
}));

vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        addonSlug: 'addon_slug',
        status: 'status',
        deletedAt: 'deleted_at'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col }))
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: mockWarn,
        debug: vi.fn()
    }
}));

// Import after mocks
import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const UUID_PLAN_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const SLUG_PLAN_ID = 'owner-basico';

/** DB-backed plan response shape (limits is Record<string,number>) */
const DB_PLAN_UUID = {
    id: UUID_PLAN_ID,
    slug: SLUG_PLAN_ID,
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner',
    monthlyPriceArs: 500,
    annualPriceArs: null,
    monthlyPriceUsdRef: 3,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    isActive: true,
    entitlements: ['ACCOMMODATION_LIST'],
    /** DB shape: key→value Record (NOT LimitDefinition[]) */
    limits: { max_accommodations: 3, max_photos_per_accommodation: 10 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

/** Limit-type addon definition from the DB-backed catalog */
const STUB_EXTRA_ACCOMMODATIONS = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations Pack (+5)',
    description: 'Adds 5 additional accommodations.',
    billingType: 'recurring' as const,
    priceArs: 1000000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: 'max_accommodations',
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 4
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MockBilling {
    subscriptions: {
        getByCustomerId: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
    entitlements: {
        grant: ReturnType<typeof vi.fn>;
        revoke: ReturnType<typeof vi.fn>;
        revokeBySource: ReturnType<typeof vi.fn>;
    };
    limits: {
        set: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
        removeBySource: ReturnType<typeof vi.fn>;
    };
}

function buildBilling(planId: string): MockBilling {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([
                {
                    id: 'sub-uuid',
                    status: 'active',
                    planId,
                    metadata: {}
                }
            ]),
            update: vi.fn().mockResolvedValue({})
        },
        entitlements: {
            grant: vi.fn().mockResolvedValue(undefined),
            revoke: vi.fn().mockResolvedValue(undefined),
            revokeBySource: vi.fn().mockResolvedValue(1)
        },
        limits: {
            set: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
            removeBySource: vi.fn().mockResolvedValue(1)
        }
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-entitlement plan-resolve regression (SPEC-192 T-025)', () => {
    let service: AddonEntitlementService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: STUB_EXTRA_ACCOMMODATIONS
        });
    });

    describe('(a) UUID planId — getById resolves the real base limit', () => {
        it('should call PlanService.getById with the UUID planId and use the real base limit', async () => {
            // Arrange
            const billing = buildBilling(UUID_PLAN_ID);
            // biome-ignore lint/suspicious/noExplicitAny: test mock — cast to satisfy QZPayBilling type
            service = new AddonEntitlementService(billing as unknown as never);

            // getById resolves the plan
            mockPlanGetById.mockResolvedValue({ success: true, data: DB_PLAN_UUID });
            // getBySlug should NOT be needed (getById already succeeded)
            mockPlanGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });

            // Act
            const result = await service.applyAddonEntitlements({
                customerId: 'cust-uuid',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase-001'
            });

            // Assert — success
            expect(result.success).toBe(true);

            // PlanService.getById was called with the UUID planId
            expect(mockPlanGetById).toHaveBeenCalledWith(UUID_PLAN_ID);

            // billing.limits.set called with the REAL base limit (3) from the DB plan.
            // (allActivePurchases from DB is empty → totalIncrement = 0, newMaxValue = 3)
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    limitKey: 'max_accommodations',
                    maxValue: 3 // basePlanLimit=3 from DB_PLAN_UUID.limits, totalIncrement=0
                })
            );
        });

        it('should NOT fall to basePlanLimit=0 when planId is a UUID (old bug path)', async () => {
            // This is the direct regression check. The OLD code would resolve
            // ALL_PLANS.find(p => p.slug === UUID_PLAN_ID) === undefined → base=0
            // → newMaxValue=0. The NEW code yields the real 3.
            const billing = buildBilling(UUID_PLAN_ID);
            // biome-ignore lint/suspicious/noExplicitAny: test mock — cast to satisfy QZPayBilling type
            service = new AddonEntitlementService(billing as unknown as never);
            mockPlanGetById.mockResolvedValue({ success: true, data: DB_PLAN_UUID });
            mockPlanGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });

            await service.applyAddonEntitlements({
                customerId: 'cust-uuid',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase-001'
            });

            const setCall = billing.limits.set.mock.calls[0];
            expect(setCall).toBeDefined();
            // maxValue must be > 0 — if it were 0 the old bug is still present
            expect(setCall?.[0]).toHaveProperty('maxValue');
            expect((setCall?.[0] as { maxValue: number }).maxValue).toBeGreaterThan(0);
        });
    });

    describe('(b) Slug planId — getBySlug fallback resolves the real base limit (legacy compat)', () => {
        it('should call PlanService.getBySlug when planId is a slug and use the real base limit', async () => {
            // Arrange — subscription uses a slug as planId (legacy row)
            const billing = buildBilling(SLUG_PLAN_ID);
            // biome-ignore lint/suspicious/noExplicitAny: test mock — cast to satisfy QZPayBilling type
            service = new AddonEntitlementService(billing as unknown as never);

            // getById fails for a non-UUID value (or returns NOT_FOUND)
            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });
            // getBySlug succeeds for the slug
            mockPlanGetBySlug.mockResolvedValue({ success: true, data: DB_PLAN_UUID });

            // Act
            const result = await service.applyAddonEntitlements({
                customerId: 'cust-uuid',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase-002'
            });

            // Assert — success
            expect(result.success).toBe(true);

            // The slug-based fallback was used
            expect(mockPlanGetBySlug).toHaveBeenCalledWith(SLUG_PLAN_ID);

            // Still uses the real base limit (3) from DB_PLAN_UUID
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    limitKey: 'max_accommodations',
                    maxValue: 3
                })
            );
        });
    });

    describe('(c) Plan truly not found — falls back to base=0 and logs a warning', () => {
        it('should fall back to basePlanLimit=0 and log a warning when both getById and getBySlug fail', async () => {
            // Arrange — both lookups fail
            const billing = buildBilling(UUID_PLAN_ID);
            // biome-ignore lint/suspicious/noExplicitAny: test mock — cast to satisfy QZPayBilling type
            service = new AddonEntitlementService(billing as unknown as never);

            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'plan not found' }
            });
            mockPlanGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'plan not found' }
            });

            // Act
            const result = await service.applyAddonEntitlements({
                customerId: 'cust-uuid',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase-003'
            });

            // Assert — operation completes (does not error out)
            expect(result.success).toBe(true);

            // A warn was logged about the unresolvable plan
            expect(mockWarn).toHaveBeenCalledWith(
                expect.objectContaining({ planId: UUID_PLAN_ID }),
                expect.any(String)
            );

            // billing.limits.set was still called (with base=0 + addon total)
            expect(billing.limits.set).toHaveBeenCalled();
        });
    });
});
