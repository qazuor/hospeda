import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted() runs before vi.mock() factories so variables declared here can
// be safely referenced inside mock factories without temporal dead zone issues.
const { execRef } = vi.hoisted(() => {
    // execRef.fn is replaced per-test to control what tx.execute() returns.
    const execRef = { fn: vi.fn().mockResolvedValue({ rows: [] }) };
    return { execRef };
});

// Mock external dependencies before importing the module under test
vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn(),
    getPlanBySlug: vi.fn()
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

import { getAddonBySlug, getPlanBySlug } from '@repo/billing';
import { recalculateAddonLimitsForCustomer } from '../../src/services/billing/addon/addon-limit-recalculation.service.js';

const mockGetAddonBySlug = getAddonBySlug as ReturnType<typeof vi.fn>;
const mockGetPlanBySlug = getPlanBySlug as ReturnType<typeof vi.fn>;

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
        // Arrange
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'active', planId: 'unknown-plan' }]);
        mockGetPlanBySlug.mockReturnValue(undefined);

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
        // Arrange
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'active', planId: 'enterprise' }]);
        mockGetPlanBySlug.mockReturnValue({
            limits: [{ key: 'max_accommodations', value: -1 }]
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
        mockGetAddonBySlug.mockReturnValue({ affectsLimitKey: 'max_accommodations' });
        mockGetPlanBySlug.mockReturnValue({
            limits: [{ key: 'max_accommodations', value: 5 }]
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
        mockGetAddonBySlug.mockReturnValue({ affectsLimitKey: 'max_photos' }); // different key
        mockGetPlanBySlug.mockReturnValue({
            limits: [{ key: 'max_accommodations', value: 5 }]
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
        // Arrange
        const mockSet = vi.fn().mockResolvedValue(undefined);
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'trialing', planId: 'starter' }], {
            setFn: mockSet
        });
        mockGetPlanBySlug.mockReturnValue({
            limits: [{ key: 'max_accommodations', value: 3 }]
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
