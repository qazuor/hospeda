/**
 * Unit tests for advisory lock and transaction semantics in
 * handlePlanChangeAddonRecalculation (SPEC-064, T-018).
 *
 * These tests validate:
 * - unit: pg_advisory_xact_lock is acquired via ctx.tx.execute() BEFORE any
 *         business logic (billing.limits.set) runs inside the transaction.
 * - unit: errors thrown inside the transaction callback propagate out of
 *         withServiceTransaction (no silent swallowing of DB-level errors).
 * - Early-return guards (feature flag, in-memory dedup) fire BEFORE the
 *         transaction is opened, so withServiceTransaction is never called.
 * - billing.limits.set is invoked from INSIDE the transaction callback scope.
 *
 * The test strategy mocks @repo/service-core so withServiceTransaction
 * delegates to a test-controlled implementation. This lets each test inject
 * a full ctx.tx mock (including .innerJoin support) without touching a real DB.
 *
 * @module test/services/addon-plan-change.advisory-lock
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePlanChangeAddonRecalculation } from '../../src/services/addon-plan-change.service';
import { createMockBilling, createMockCustomer } from '../helpers/mock-factories';

// ─── Hoisted factories ────────────────────────────────────────────────────────
//
// Variables used inside vi.mock() factory functions MUST be declared with
// vi.hoisted() because vi.mock() is statically hoisted to the top of the file.

const { mockWithServiceTransaction, mockSendNotification, mockCaptureSentryMessage } = vi.hoisted(
    () => {
        /**
         * Default passthrough: executes the callback with a minimal tx mock that
         * handles all DB call patterns used by the service.
         */
        const buildDefaultTx = (
            overrides?: Partial<{
                execute: ReturnType<typeof vi.fn>;
                selectResult: unknown[];
            }>
        ) => {
            const emptySelectChain = (rows: unknown[] = []) => {
                const limit = vi.fn().mockResolvedValue(rows);
                const where = vi.fn().mockReturnValue({ limit });
                const innerJoin = vi.fn().mockReturnValue({ where });
                const from = vi.fn().mockReturnValue({ where, innerJoin });
                return { select: vi.fn().mockReturnValue({ from }) };
            };

            const { select } = emptySelectChain(overrides?.selectResult ?? []);
            return {
                execute: overrides?.execute ?? vi.fn().mockResolvedValue([]),
                select
            };
        };

        const mockWithServiceTransaction = vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
            return cb({ tx: buildDefaultTx(), hookState: {} });
        });

        const mockSendNotification = vi.fn().mockResolvedValue(undefined);
        const mockCaptureSentryMessage = vi.fn().mockReturnValue('');

        return {
            mockWithServiceTransaction,
            buildDefaultTx,
            mockSendNotification,
            mockCaptureSentryMessage
        };
    }
);

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock @repo/service-core — replaces withServiceTransaction with the test-
// controlled implementation declared above.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        withServiceTransaction: (...args: unknown[]) =>
            mockWithServiceTransaction(...(args as Parameters<typeof mockWithServiceTransaction>))
    };
});

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/addon-downgrade-detection.service', () => ({
    detectAndNotifyDowngrades: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: (...args: unknown[]) => mockSendNotification(...args)
}));

vi.mock('@sentry/node', () => ({
    captureMessage: (...args: unknown[]) => mockCaptureSentryMessage(...args),
    captureException: vi.fn()
}));

// billingAddonPurchases is imported dynamically inside the callback.
vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    }
}));

// billingSubscriptionEvents and billingSubscriptions are imported dynamically
// from '@repo/db' (not the subpath) inside the transaction callback.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        billingSubscriptionEvents: {
            id: 'id',
            subscriptionId: 'subscription_id',
            eventType: 'event_type',
            createdAt: 'created_at'
        },
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id'
        },
        withTransaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
            cb({
                execute: vi.fn().mockResolvedValue([]),
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                })
            })
        )
    };
});

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        getPlanBySlug: vi.fn(),
        getAddonBySlug: vi.fn()
    };
});

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return { ...actual };
});

// ─── SQL inspection helper ────────────────────────────────────────────────────
//
// Drizzle-orm sql`` tagged template produces an object with `queryChunks` —
// each chunk is either a string-array value or a raw parameter. String()
// returns "[object Object]", so we reconstruct the SQL text from queryChunks.

function extractSqlText(sqlExpr: unknown): string {
    if (
        sqlExpr !== null &&
        typeof sqlExpr === 'object' &&
        'queryChunks' in sqlExpr &&
        Array.isArray((sqlExpr as { queryChunks: unknown[] }).queryChunks)
    ) {
        return (sqlExpr as { queryChunks: unknown[] }).queryChunks
            .map((chunk) => {
                if (
                    chunk !== null &&
                    typeof chunk === 'object' &&
                    'value' in chunk &&
                    Array.isArray((chunk as { value: unknown[] }).value)
                ) {
                    return (chunk as { value: unknown[] }).value.join('');
                }
                return String(chunk);
            })
            .join('');
    }
    return String(sqlExpr);
}

// ─── Dedup guard bypass ───────────────────────────────────────────────────────
//
// The module-level recentRecalculations Map persists across tests. Each
// beforeEach advances Date.now() by 10 minutes so the stored timestamp
// appears stale and the guard never triggers unexpectedly.

let dateNowOffset = 0;
const DEDUP_BYPASS_OFFSET_MS = 10 * 60 * 1000;

beforeEach(() => {
    dateNowOffset += DEDUP_BYPASS_OFFSET_MS;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + dateNowOffset);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Constants & fixtures ─────────────────────────────────────────────────────

const OLD_PLAN_SLUG = 'owner-pro';
const NEW_PLAN_SLUG = 'owner-basico';
const LIMIT_KEY = 'max_active_accommodations';
const CUSTOMER_ID = 'cus_advisory_lock_test_001';

const mockOldPlan = {
    slug: OLD_PLAN_SLUG,
    name: 'Owner Pro',
    description: 'Pro plan',
    monthlyPriceArs: 5000,
    annualPriceArs: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 2,
    features: [],
    limits: [{ key: LIMIT_KEY, value: 10 }],
    entitlements: []
};

const mockNewPlan = {
    slug: NEW_PLAN_SLUG,
    name: 'Owner Basico',
    description: 'Basic plan',
    monthlyPriceArs: 2000,
    annualPriceArs: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1,
    features: [],
    limits: [{ key: LIMIT_KEY, value: 3 }],
    entitlements: []
};

const mockAddonDef = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations (+5)',
    description: '+5 accommodations',
    billingType: 'recurring' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: LIMIT_KEY,
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

/** One active purchase row with a +5 adjustment for LIMIT_KEY */
const activePurchaseRow = {
    id: 'purch_advisory_001',
    customerId: CUSTOMER_ID,
    addonSlug: 'extra-accommodations-5',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [{ limitKey: LIMIT_KEY, increase: 5 }],
    entitlementAdjustments: []
};

/**
 * Builds a tx mock with full chain support for all DB patterns used by the
 * service inside withServiceTransaction:
 *  - execute(): advisory lock + statement_timeout
 *  - select().from().innerJoin().where().limit(): DB dedup check
 *  - select().from().where(): purchases query
 *
 * @param overrideExecute - Optional custom execute mock for IT-1 / IT-2 scenarios
 * @param dedupRows - Rows returned by the DB dedup check (default: [])
 * @param purchaseRows - Rows returned by the purchases query (default: [])
 */
function buildFullTxMock(opts?: {
    overrideExecute?: ReturnType<typeof vi.fn>;
    dedupRows?: unknown[];
    purchaseRows?: unknown[];
}): {
    execute: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
} {
    const { overrideExecute, dedupRows = [], purchaseRows = [] } = opts ?? {};

    // Purchases query: ctx.tx.select().from(billingAddonPurchases).where(...)
    // The purchases query does NOT use innerJoin.
    const purchasesWhere = vi.fn().mockResolvedValue(purchaseRows);
    const purchasesFrom = vi.fn().mockReturnValue({ where: purchasesWhere });
    const _purchasesSelect = vi.fn().mockReturnValue({ from: purchasesFrom });

    // DB dedup query: ctx.tx.select({id: ...}).from(...).innerJoin(...).where(...).limit(1)
    const dedupLimit = vi.fn().mockResolvedValue(dedupRows);
    const dedupWhere = vi.fn().mockReturnValue({ limit: dedupLimit });
    const dedupInnerJoin = vi.fn().mockReturnValue({ where: dedupWhere });
    const dedupFrom = vi.fn().mockReturnValue({ where: dedupWhere, innerJoin: dedupInnerJoin });
    const _dedupSelect = vi.fn().mockReturnValue({ from: dedupFrom });

    // Multiplex select() calls:
    //  - select({ id: ... }) — dedup check (has a specific field key "id")
    //  - select() / select({}) — purchases query (no args or empty)
    const selectMux = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
        const isDedupQuery =
            fields !== undefined &&
            typeof fields === 'object' &&
            'id' in fields &&
            Object.keys(fields).length === 1;
        return isDedupQuery ? { from: dedupFrom } : { from: purchasesFrom };
    });

    return {
        execute: overrideExecute ?? vi.fn().mockResolvedValue([]),
        select: selectMux
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handlePlanChangeAddonRecalculation — advisory lock (SPEC-064 T-018)', () => {
    let billing: QZPayBilling;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockSendNotification.mockResolvedValue(undefined);
        mockCaptureSentryMessage.mockReturnValue('');

        const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === OLD_PLAN_SLUG) return mockOldPlan;
            if (slug === NEW_PLAN_SLUG) return mockNewPlan;
            return null;
        });
        (getAddonBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === 'extra-accommodations-5') return mockAddonDef;
            return null;
        });

        billing = createMockBilling();
        (billing.limits.set as unknown as MockInstance).mockResolvedValue(undefined);
        (billing.limits.check as unknown as MockInstance).mockResolvedValue({ currentValue: 0 });
        (billing.customers.get as unknown as MockInstance).mockResolvedValue(
            createMockCustomer({ id: CUSTOMER_ID })
        );

        // Reset withServiceTransaction to default passthrough
        mockWithServiceTransaction.mockImplementation(
            async (cb: (ctx: unknown) => Promise<unknown>) => {
                const tx = buildFullTxMock({ purchaseRows: [] });
                return cb({ tx, hookState: {} });
            }
        );
    });

    // ── unit: Advisory lock is acquired before business logic ─────────────────

    describe('unit: pg_advisory_xact_lock acquired before billing.limits.set', () => {
        it('should call tx.execute(pg_advisory_xact_lock) before billing.limits.set', async () => {
            // Arrange — intercept the withServiceTransaction callback to inject a
            // tx that records the order of execute() and limits.set() calls.
            const callOrder: string[] = [];

            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    const executeWithOrder = vi.fn().mockImplementation((sqlExpr: unknown) => {
                        const sqlStr = extractSqlText(sqlExpr);
                        if (sqlStr.includes('pg_advisory_xact_lock')) {
                            callOrder.push('advisory_lock');
                        }
                        return Promise.resolve([]);
                    });

                    const tx = buildFullTxMock({
                        overrideExecute: executeWithOrder,
                        purchaseRows: [activePurchaseRow]
                    });

                    // Wrap billing.limits.set to record when it fires
                    const originalImpl = (
                        billing.limits.set as unknown as MockInstance
                    ).getMockImplementation();
                    (billing.limits.set as unknown as MockInstance).mockImplementation(
                        async (...args: unknown[]) => {
                            callOrder.push('limits_set');
                            return originalImpl ? originalImpl(...args) : undefined;
                        }
                    );

                    return cb({ tx, hookState: {} });
                }
            );

            const db = {
                select: vi.fn(),
                execute: vi.fn().mockResolvedValue([])
            };

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — withServiceTransaction was called twice: Phase 1 (read+lock) + Phase 3 (dedup write)
            expect(mockWithServiceTransaction).toHaveBeenCalledTimes(2);

            // Assert — advisory_lock must come before limits_set
            const advisoryLockIdx = callOrder.indexOf('advisory_lock');
            const limitsSetIdx = callOrder.indexOf('limits_set');

            expect(advisoryLockIdx).toBeGreaterThanOrEqual(0);
            expect(limitsSetIdx).toBeGreaterThanOrEqual(0);
            expect(advisoryLockIdx).toBeLessThan(limitsSetIdx);
        });

        it('should pass a numeric lock ID (hashed customer ID) to pg_advisory_xact_lock', async () => {
            // Arrange — capture all SQL strings passed to tx.execute()
            const executedSqlStrings: string[] = [];

            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    const captureExecute = vi.fn().mockImplementation((sqlExpr: unknown) => {
                        executedSqlStrings.push(extractSqlText(sqlExpr));
                        return Promise.resolve([]);
                    });

                    const tx = buildFullTxMock({
                        overrideExecute: captureExecute,
                        purchaseRows: []
                    });
                    return cb({ tx, hookState: {} });
                }
            );

            const db = {
                select: vi.fn(),
                execute: vi.fn().mockResolvedValue([])
            };

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — at least one execute call contains pg_advisory_xact_lock
            const advisoryCall = executedSqlStrings.find((s) =>
                s.includes('pg_advisory_xact_lock')
            );
            expect(advisoryCall).toBeDefined();

            // Assert — the argument is a number (hashCustomerId always returns an integer)
            expect(advisoryCall).toMatch(/pg_advisory_xact_lock\(\d+\)/);
        });

        it('should pass a deterministic lock ID — same customer always produces the same hash', async () => {
            // Arrange — capture the lock IDs from two separate calls with the same customerId
            const capturedLockIds: number[] = [];

            const makeCapturingMock = () =>
                mockWithServiceTransaction.mockImplementation(
                    async (cb: (ctx: unknown) => Promise<unknown>) => {
                        const captureExecute = vi.fn().mockImplementation((sqlExpr: unknown) => {
                            const s = extractSqlText(sqlExpr);
                            const m = s.match(/pg_advisory_xact_lock\((\d+)\)/);
                            if (m?.[1]) {
                                capturedLockIds.push(Number(m[1]));
                            }
                            return Promise.resolve([]);
                        });
                        const tx = buildFullTxMock({ overrideExecute: captureExecute });
                        return cb({ tx, hookState: {} });
                    }
                );

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // First call
            makeCapturingMock();
            dateNowOffset += DEDUP_BYPASS_OFFSET_MS; // advance time past dedup window
            vi.spyOn(Date, 'now').mockReturnValue(Date.now() + dateNowOffset);
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Second call — different time, same customer
            makeCapturingMock();
            dateNowOffset += DEDUP_BYPASS_OFFSET_MS;
            vi.spyOn(Date, 'now').mockReturnValue(Date.now() + dateNowOffset);
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — both calls used the same numeric lock ID
            expect(capturedLockIds).toHaveLength(2);
            expect(capturedLockIds[0]).toBe(capturedLockIds[1]);
        });
    });

    // ── unit: Error propagation from the transaction callback ─────────────────

    describe('unit: transaction callback errors propagate out of withServiceTransaction', () => {
        it('should propagate when tx.execute() throws during lock acquisition', async () => {
            // Arrange — tx.execute() rejects, simulating a DB failure when acquiring the lock
            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    const failingExecute = vi
                        .fn()
                        .mockRejectedValue(new Error('DB connection lost mid-transaction'));
                    const tx = buildFullTxMock({ overrideExecute: failingExecute });
                    // The callback propagates the error — withServiceTransaction does not swallow it
                    return cb({ tx, hookState: {} });
                }
            );

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // Act & Assert — the rejected promise must escape to the caller
            await expect(
                handlePlanChangeAddonRecalculation({
                    customerId: CUSTOMER_ID,
                    oldPlanId: OLD_PLAN_SLUG,
                    newPlanId: NEW_PLAN_SLUG,
                    billing,
                    db: db as never
                })
            ).rejects.toThrow('DB connection lost mid-transaction');
        });

        it('should record per-key failure outcome when billing.limits.set rejects', async () => {
            // Arrange — the service catches per-key errors and continues processing
            // other keys (resilient design). This test verifies that behaviour.
            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    const tx = buildFullTxMock({ purchaseRows: [activePurchaseRow] });
                    return cb({ tx, hookState: {} });
                }
            );

            (billing.limits.set as unknown as MockInstance).mockRejectedValue(
                new Error('QZPay service temporarily unavailable')
            );

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — service does not throw; the failed key is recorded
            expect(result.recalculations).toHaveLength(1);
            expect(result.recalculations[0]?.outcome).toBe('failed');
            expect(result.recalculations[0]?.reason).toContain(
                'QZPay service temporarily unavailable'
            );
        });

        it('should record first key success and second key failure when set() fails on the 2nd call', async () => {
            // Arrange — two limit-key purchases; set() succeeds on the first and rejects on the second
            const secondKeyPurchase = {
                id: 'purch_second_key',
                customerId: CUSTOMER_ID,
                addonSlug: 'extra-featured-3',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_featured_listings', increase: 3 }],
                entitlementAdjustments: []
            };

            const { getAddonBySlug, getPlanBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
                if (slug === 'extra-accommodations-5') return mockAddonDef;
                if (slug === 'extra-featured-3') {
                    return {
                        ...mockAddonDef,
                        slug: 'extra-featured-3',
                        affectsLimitKey: 'max_featured_listings',
                        limitIncrease: 3
                    };
                }
                return null;
            });
            (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
                if (slug === OLD_PLAN_SLUG) {
                    return {
                        ...mockOldPlan,
                        limits: [
                            { key: LIMIT_KEY, value: 10 },
                            { key: 'max_featured_listings', value: 2 }
                        ]
                    };
                }
                if (slug === NEW_PLAN_SLUG) {
                    return {
                        ...mockNewPlan,
                        limits: [
                            { key: LIMIT_KEY, value: 3 },
                            { key: 'max_featured_listings', value: 1 }
                        ]
                    };
                }
                return null;
            });

            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    const tx = buildFullTxMock({
                        purchaseRows: [activePurchaseRow, secondKeyPurchase]
                    });
                    return cb({ tx, hookState: {} });
                }
            );

            (billing.limits.set as unknown as MockInstance)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('QZPay unavailable'));

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — two recalculations: one success, one failed
            expect(result.recalculations).toHaveLength(2);
            const successes = result.recalculations.filter((r) => r.outcome === 'success');
            const failures = result.recalculations.filter((r) => r.outcome === 'failed');
            expect(successes).toHaveLength(1);
            expect(failures).toHaveLength(1);
            expect(failures[0]?.reason).toContain('QZPay unavailable');
        });
    });

    // ── Early-return guards bypass the transaction ────────────────────────────

    describe('early-return guards bypass withServiceTransaction', () => {
        it('should NOT call withServiceTransaction when the feature flag is disabled', async () => {
            // Arrange — override env to disable the addon lifecycle feature
            const envModule = await import('../../src/utils/env');
            vi.spyOn(envModule, 'env', 'get').mockReturnValue({
                ...envModule.env,
                HOSPEDA_ADDON_LIFECYCLE_ENABLED: false
            } as never);

            // Reset spy call count so we can assert "not called"
            mockWithServiceTransaction.mockClear();

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — no transaction opened; early return with empty recalculations
            expect(mockWithServiceTransaction).not.toHaveBeenCalled();
            expect(result.recalculations).toHaveLength(0);
            expect(result.direction).toBe('lateral');
        });

        it('should NOT call withServiceTransaction when in-memory dedup guard fires', async () => {
            // Use a customer ID unique to this test to avoid contamination from
            // other tests that may have seeded recentRecalculations for CUSTOMER_ID.
            const DEDUP_TEST_CUSTOMER = 'cus_dedup_unique_guard_test_xyz';

            // Arrange — freeze time so both calls share the same Date.now() value.
            // The dedup window is 5 minutes; 0ms elapsed guarantees the guard fires.
            const frozenTs = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(frozenTs);

            // The first call must produce at least one limitAddon to avoid the
            // Step-4 early-return that bypasses recentRecalculations.set(). Provide
            // one active purchase so the full callback path runs and seeds the map.
            const purchaseForDedup = {
                id: 'purch_dedup_seed',
                customerId: DEDUP_TEST_CUSTOMER,
                addonSlug: 'extra-accommodations-5',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: LIMIT_KEY, increase: 5 }],
                entitlementAdjustments: []
            };

            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    const tx = buildFullTxMock({ purchaseRows: [purchaseForDedup] });
                    return cb({ tx, hookState: {} });
                }
            );

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // First call — seeds recentRecalculations[DEDUP_TEST_CUSTOMER] = frozenTs
            await handlePlanChangeAddonRecalculation({
                customerId: DEDUP_TEST_CUSTOMER,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Verify first call went through the transaction (map was seeded).
            // Phase 1 (read + advisory lock) + Phase 3 (dedup event write) = 2 calls.
            expect(mockWithServiceTransaction).toHaveBeenCalledTimes(2);
            mockWithServiceTransaction.mockClear();

            // Act — second call for same customer with Date.now() still frozen
            const result = await handlePlanChangeAddonRecalculation({
                customerId: DEDUP_TEST_CUSTOMER,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — dedup guard fires before transaction opens (0 ms elapsed)
            expect(mockWithServiceTransaction).not.toHaveBeenCalled();
            expect(result.recalculations).toHaveLength(0);
            expect(result.direction).toBe('lateral');
        });
    });

    // ── billing.limits.set is invoked OUTSIDE the transaction scope ──────────
    //
    // SPEC-064 design: QZPay calls (billing.limits.set) happen in Phase 2,
    // which runs AFTER the Phase 1 transaction has already committed. This keeps
    // the DB transaction short and avoids holding row-level locks during slow
    // external HTTP round-trips. If QZPay is slow or fails, the DB has already
    // released its locks. The dedup event is written in a separate Phase 3
    // transaction that records the outcome AFTER QZPay completes.

    describe('billing.limits.set is invoked OUTSIDE the withServiceTransaction callback (Phase 2)', () => {
        it('should call billing.limits.set AFTER the Phase 1 withServiceTransaction callback returns', async () => {
            // Arrange — flag is set to true when limits.set is called from
            // OUTSIDE the Phase 1 callback (the correct, intended behavior).
            let phase1CallbackReturned = false;
            let limitsSetCalledAfterPhase1 = false;

            // Track Phase 1 completion — first call to withServiceTransaction is Phase 1
            let phase1Done = false;
            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    if (!phase1Done) {
                        // Phase 1: data read phase
                        const tx = buildFullTxMock({ purchaseRows: [activePurchaseRow] });
                        const result = await cb({ tx, hookState: {} });
                        phase1CallbackReturned = true;
                        phase1Done = true;
                        return result;
                    }
                    // Phase 3: dedup event write phase
                    const tx = buildFullTxMock({ purchaseRows: [] });
                    return cb({ tx, hookState: {} });
                }
            );

            const originalLimitsSetImpl = (
                billing.limits.set as unknown as MockInstance
            ).getMockImplementation();
            (billing.limits.set as unknown as MockInstance).mockImplementation(
                async (...args: unknown[]) => {
                    if (phase1CallbackReturned) {
                        limitsSetCalledAfterPhase1 = true;
                    }
                    return originalLimitsSetImpl ? originalLimitsSetImpl(...args) : undefined;
                }
            );

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — limits.set was called AFTER Phase 1 callback returned
            expect(limitsSetCalledAfterPhase1).toBe(true);
            expect(billing.limits.set).toHaveBeenCalledOnce();
        });

        it('should call withServiceTransaction twice: Phase 1 (read+lock) and Phase 3 (dedup write)', async () => {
            // Arrange
            mockWithServiceTransaction.mockClear();
            let phase1Done = false;
            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    const tx = buildFullTxMock({
                        purchaseRows: phase1Done ? [] : [activePurchaseRow]
                    });
                    phase1Done = true;
                    return cb({ tx, hookState: {} });
                }
            );

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — Phase 1 (read) + Phase 3 (dedup event write) = 2 calls
            expect(mockWithServiceTransaction).toHaveBeenCalledTimes(2);
        });
    });

    // ── statement_timeout is handled by withServiceTransaction ───────────────

    describe('SET LOCAL statement_timeout is handled by withServiceTransaction', () => {
        it('should call withServiceTransaction exactly once per invocation', async () => {
            // Arrange
            mockWithServiceTransaction.mockClear();

            mockWithServiceTransaction.mockImplementation(
                async (cb: (ctx: unknown) => Promise<unknown>) => {
                    const tx = buildFullTxMock({ purchaseRows: [] });
                    return cb({ tx, hookState: {} });
                }
            );

            const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — the timeout configuration lives inside withServiceTransaction;
            // the service calls it exactly once, delegating timeout management to the utility.
            expect(mockWithServiceTransaction).toHaveBeenCalledOnce();
        });
    });
});
