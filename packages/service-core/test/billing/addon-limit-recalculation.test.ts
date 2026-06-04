import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted() runs before vi.mock() factories so variables declared here can
// be safely referenced inside mock factories without temporal dead zone issues.
const { execRef, mockPlanGetById, mockPlanGetBySlug, mockCatalogGetBySlug } = vi.hoisted(() => {
    // execRef.fn is replaced per-test to control what tx.execute() returns.
    const execRef = { fn: vi.fn().mockResolvedValue({ rows: [] }) };
    const mockPlanGetById = vi.fn();
    const mockPlanGetBySlug = vi.fn();
    const mockCatalogGetBySlug = vi.fn();
    return { execRef, mockPlanGetById, mockPlanGetBySlug, mockCatalogGetBySlug };
});

// Mock external dependencies before importing the module under test
// (kept for the 3 passing tests that still reference getPlanBySlug/getAddonBySlug)
vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn(),
    getPlanBySlug: vi.fn()
}));

// SPEC-192 T-027 cutover: recalculation service now uses DB-backed PlanService
// and AddonCatalogService (internal package imports). Mock them via the paths
// as the test loader resolves them from this file's location.
vi.mock('../../src/services/billing/plan/plan.service.js', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        getById: mockPlanGetById,
        getBySlug: mockPlanGetBySlug
    }))
}));

vi.mock('../../src/services/billing/addon/addon-catalog.service.js', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockCatalogGetBySlug,
        list: vi.fn()
    }))
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    }
}));

// Mock @repo/db to provide withTransaction and sql.
// withTransaction calls the callback with a proxy tx whose execute() method
// delegates to execRef.fn, which each test configures via setExecResult().
vi.mock('@repo/db', () => ({
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            type: 'sql',
            strings,
            values
        })),
        { raw: vi.fn((s: string) => ({ type: 'sql.raw', s })) }
    ),
    withTransaction: vi.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx: Record<string, unknown> = {
            execute: vi.fn((..._args: unknown[]) => execRef.fn(..._args))
        };
        return fn(tx);
    })
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    isNull: vi.fn((col: unknown) => ({ col, isNull: true })),
    // Needed by @repo/db schema files that call relations() at module load time
    relations: vi.fn(() => ({})),
    many: vi.fn(() => ({})),
    one: vi.fn(() => ({})),
    sql: Object.assign(
        vi.fn((_strings: unknown, ..._values: unknown[]) => ({ type: 'sql' })),
        { raw: vi.fn((s: string) => ({ type: 'sql.raw', s })) }
    )
}));

import { recalculateAddonLimitsForCustomer } from '../../src/services/billing/addon/addon-limit-recalculation.service.js';

/**
 * Configure what tx.execute() returns for the current test.
 * The service uses tx.execute() inside withTransaction to query
 * billing_addon_purchases with FOR UPDATE.
 */
function setExecResult(purchases: unknown[]): void {
    execRef.fn = vi.fn().mockResolvedValue({ rows: purchases });
}

/**
 * Configure tx.execute() to reject with the given error.
 */
function setExecError(error: Error): void {
    execRef.fn = vi.fn().mockRejectedValue(error);
}

/** Build a minimal mock QZPay billing client */
function buildMockBilling(
    subscriptions: unknown[],
    overrides: {
        setFn?: ReturnType<typeof vi.fn>;
        removeBySourceFn?: ReturnType<typeof vi.fn>;
    } = {}
) {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        },
        limits: {
            set: overrides.setFn ?? vi.fn().mockResolvedValue(undefined),
            removeBySource: overrides.removeBySourceFn ?? vi.fn().mockResolvedValue(undefined)
        }
    };
}

/** Minimal stub for the db parameter (service ignores it; withTransaction is used instead) */
const stubDb = {} as never;

describe('recalculateAddonLimitsForCustomer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: no purchases
        setExecResult([]);

        // Default plan resolution: getById returns NOT_FOUND → getBySlug fallback
        mockPlanGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'plan not found by id' }
        });
        // Default: plan not found (each test overrides as needed)
        mockPlanGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'plan not found' }
        });

        // Default: addon not found (each test overrides as needed)
        mockCatalogGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'addon not found' }
        });
    });

    it('should return failed outcome when customer has no subscriptions', async () => {
        // Arrange
        setExecResult([]);
        const billing = buildMockBilling([]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/no subscriptions/i);
    });

    it('should return failed outcome when customer has no active subscription', async () => {
        // Arrange
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'cancelled', planId: 'starter' }]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/no active/i);
    });

    it('should return failed outcome when plan is not found in canonical config', async () => {
        // Arrange — after SPEC-192 T-027 cutover, plan resolution uses PlanService (DB-backed)
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'active', planId: 'unknown-plan' }]);
        // Both getById and getBySlug return NOT_FOUND (default from beforeEach)

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/unknown-plan/);
    });

    it('should return skipped outcome when base plan has unlimited (-1) for the limitKey', async () => {
        // Arrange — after T-027 cutover, plan limits are Record<string,number> (not array)
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'active', planId: 'enterprise' }]);
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'plan-uuid-enterprise',
                slug: 'enterprise',
                limits: { max_accommodations: -1 }
            }
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('skipped');
        expect(result.newMaxValue).toBe(-1);
    });

    it('should call billing.limits.set when there are active addon increments', async () => {
        // Arrange
        const mockSet = vi.fn().mockResolvedValue(undefined);
        const purchases = [
            {
                addonSlug: 'extra-listings',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 10 }]
            }
        ];
        setExecResult(purchases);
        const billing = buildMockBilling([{ status: 'active', planId: 'starter' }], {
            setFn: mockSet
        });
        // After T-027 cutover: catalog returns addon def, plan service returns Record<string,number>
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-listings',
                affectsLimitKey: 'max_accommodations',
                limitIncrease: 10
            }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: { id: 'plan-uuid-starter', slug: 'starter', limits: { max_accommodations: 5 } }
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(15); // base(5) + addon(10)
        expect(result.addonCount).toBe(1);
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'cust-1',
                limitKey: 'max_accommodations',
                maxValue: 15
            })
        );
    });

    it('should call billing.limits.removeBySource when no addons contribute to the limitKey', async () => {
        // Arrange — addon exists but does not affect this limitKey
        const mockRemoveBySource = vi.fn().mockResolvedValue(undefined);
        const purchases = [
            {
                addonSlug: 'extra-photos',
                status: 'active',
                deletedAt: null,
                limitAdjustments: []
            }
        ];
        setExecResult(purchases);
        const billing = buildMockBilling([{ status: 'active', planId: 'starter' }], {
            removeBySourceFn: mockRemoveBySource
        });
        // After T-027 cutover: catalog returns addon with different key; plan has Record<string,number>
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: { slug: 'extra-photos', affectsLimitKey: 'max_photos', limitIncrease: 20 }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: { id: 'plan-uuid-starter', slug: 'starter', limits: { max_accommodations: 5 } }
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(5); // only base plan
        expect(mockRemoveBySource).toHaveBeenCalled();
    });

    it('should return failed outcome when an unexpected error is thrown', async () => {
        // Arrange — tx.execute() rejects to simulate a DB crash
        setExecError(new Error('unexpected db crash'));
        const billing = buildMockBilling([]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/unexpected error/i);
    });

    it('should handle trialing subscription as active', async () => {
        // Arrange — after T-027 cutover, plan limits via PlanService (Record<string,number>)
        const mockSet = vi.fn().mockResolvedValue(undefined);
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'trialing', planId: 'starter' }], {
            setFn: mockSet
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: { id: 'plan-uuid-starter', slug: 'starter', limits: { max_accommodations: 3 } }
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert — no addons, so removeBySource is called but outcome is still success
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(3);
    });
});
