/**
 * IT-6: Compensating event on local transaction failure (SPEC-064 T-023)
 *
 * Tests that when QZPay changePlan() succeeds but the local DB transaction
 * (addon recalculation) throws, the handler:
 *   1. Inserts a PLAN_CHANGE_LOCAL_FAILED compensating event via the
 *      top-level DB connection (outside the rolled-back transaction).
 *   2. Does NOT re-throw the error (the route returns success because
 *      QZPay already confirmed the plan change).
 *
 * Also verifies the BILLING_EVENT_TYPES.PLAN_CHANGE_LOCAL_FAILED constant.
 *
 * @module test/routes/billing/plan-change-compensating
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks — declared before imports (vi.mock is hoisted by Vitest)
// ============================================================================

// Mock env module so route-factory and cors middleware don't crash at import.
vi.mock('../../../src/utils/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/env')>();
    return {
        ...actual,
        env: { ...actual.env, NODE_ENV: 'test' },
        validateApiEnv: vi.fn()
    };
});

// Mock billing middleware — preserve all real exports but replace getQZPayBilling.
// billingMiddleware is referenced by create-app.ts at import time and must be present.
vi.mock('../../../src/middlewares/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/billing')>();
    return {
        ...actual,
        getQZPayBilling: vi.fn(),
        requireBilling: vi.fn((_c: unknown, next: () => void) => next()),
        billingMiddleware: vi.fn((_c: unknown, next: () => void) => next())
    };
});

// Mock entitlement middleware — preserve real exports including entitlementMiddleware.
vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        clearEntitlementCache: vi.fn(),
        entitlementMiddleware: vi.fn(() => vi.fn((_c: unknown, next: () => void) => next()))
    };
});

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock addon plan-change service — controls whether the local transaction succeeds.
vi.mock('../../../src/services/addon-plan-change.service', () => ({
    handlePlanChangeAddonRecalculation: vi.fn()
}));

// Mock @repo/service-core: pass through constants/types but override
// withServiceTransaction so each test can control whether it throws.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        withServiceTransaction: vi.fn()
    };
});

// Mock @repo/db: expose a configurable getDb() and stub the
// billingSubscriptionEvents table reference used by the handler.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getDb: vi.fn(),
        billingSubscriptionEvents: {
            id: 'id',
            subscriptionId: 'subscription_id',
            eventType: 'event_type',
            triggerSource: 'trigger_source',
            metadata: 'metadata',
            createdAt: 'created_at'
        }
    };
});

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { getDb } from '@repo/db';
import { BILLING_EVENT_TYPES, withServiceTransaction } from '@repo/service-core';
import type { Context } from 'hono';
import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';
import type { PlanChangeRecalculationResult } from '../../../src/services/addon-plan-change.service';
import { handlePlanChangeAddonRecalculation } from '../../../src/services/addon-plan-change.service';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Builds a minimal Hono context stub for handlePlanChange.
 *
 * The handler reads billingEnabled, billingCustomerId, and the JSON body
 * from the context. It does not call c.json() directly — it returns data
 * that the route factory serialises.
 */
function buildContext({
    billingEnabled = true,
    billingCustomerId = 'cust_test_001',
    body = {
        newPlanId: 'plan_pro',
        billingInterval: 'monthly'
    }
}: {
    billingEnabled?: boolean;
    billingCustomerId?: string | null;
    body?: Record<string, unknown>;
} = {}): Parameters<typeof handlePlanChange>[0] {
    return {
        get: vi.fn((key: string) => {
            if (key === 'billingEnabled') return billingEnabled;
            if (key === 'billingCustomerId') return billingCustomerId;
            return undefined;
        }),
        req: {
            json: vi.fn().mockResolvedValue(body)
        }
    } as unknown as Parameters<typeof handlePlanChange>[0];
}

/**
 * Builds a mock QZPay billing instance wired for a successful plan change.
 * The changePlan result reflects a Basic → Pro upgrade.
 */
function buildBillingMock({
    currentPlanId = 'plan_basico',
    newPlanId = 'plan_pro',
    subscriptionId = 'sub_test_001'
}: {
    currentPlanId?: string;
    newPlanId?: string;
    subscriptionId?: string;
} = {}) {
    const basicPrice = { id: 'price_basico_monthly', billingInterval: 'month', unitAmount: 5000 };
    const proPrice = { id: 'price_pro_monthly', billingInterval: 'month', unitAmount: 15000 };

    const currentSubscription = {
        id: subscriptionId,
        customerId: 'cust_test_001',
        planId: currentPlanId,
        status: 'active',
        interval: 'month'
    };

    const updatedSubscription = {
        id: subscriptionId,
        customerId: 'cust_test_001',
        planId: newPlanId,
        status: 'active',
        interval: 'month'
    };

    const changePlanResult = {
        subscription: updatedSubscription,
        proration: {
            creditAmount: 2000,
            chargeAmount: 8000,
            effectiveDate: new Date('2025-06-01T00:00:00Z')
        }
    };

    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([currentSubscription]),
            changePlan: vi.fn().mockResolvedValue(changePlanResult)
        },
        plans: {
            get: vi.fn().mockImplementation((id: string) => {
                if (id === currentPlanId) {
                    return Promise.resolve({
                        id: currentPlanId,
                        prices: [basicPrice]
                    });
                }
                if (id === newPlanId) {
                    return Promise.resolve({
                        id: newPlanId,
                        prices: [proPrice]
                    });
                }
                return Promise.resolve(null);
            })
        }
    };
}

/**
 * Builds a mock DB instance with a spy on insert().values().
 *
 * The insert chain: db.insert(table) → { values: fn }
 * values() resolves to undefined (simulates a successful INSERT).
 */
function buildDbMockWithInsertSpy() {
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    const insertSpy = vi.fn().mockReturnValue({ values: valuesSpy });

    const mockDb = { insert: insertSpy };
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    return { insertSpy, valuesSpy };
}

// ============================================================================
// Unit test: BILLING_EVENT_TYPES constant
// ============================================================================

describe('BILLING_EVENT_TYPES constant', () => {
    it('should export PLAN_CHANGE_LOCAL_FAILED with value "PLAN_CHANGE_LOCAL_FAILED"', () => {
        // Assert - constant value is the literal string, not a typo
        expect(BILLING_EVENT_TYPES.PLAN_CHANGE_LOCAL_FAILED).toBe('PLAN_CHANGE_LOCAL_FAILED');
    });

    it('should be a readonly string constant (typeof === "string")', () => {
        expect(typeof BILLING_EVENT_TYPES.PLAN_CHANGE_LOCAL_FAILED).toBe('string');
    });

    it('should include PLAN_CHANGE_LOCAL_FAILED among the exported event types', () => {
        // Guard against accidental key removal
        expect(Object.keys(BILLING_EVENT_TYPES)).toContain('PLAN_CHANGE_LOCAL_FAILED');
    });
});

// ============================================================================
// IT-6: Compensating event on local transaction failure
// ============================================================================

describe('IT-6 — handlePlanChange: compensating event on local transaction failure', () => {
    const OLD_PLAN_ID = 'plan_basico';
    const NEW_PLAN_ID = 'plan_pro';
    const SUBSCRIPTION_ID = 'sub_test_001';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── Core IT-6 scenario ────────────────────────────────────────────────────

    describe('when QZPay changePlan() succeeds but withServiceTransaction throws', () => {
        it('should INSERT a PLAN_CHANGE_LOCAL_FAILED event into billingSubscriptionEvents', async () => {
            // Arrange
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );

            // Local transaction throws after QZPay succeeds
            vi.mocked(withServiceTransaction).mockRejectedValue(
                new Error('DB connection lost during addon recalculation')
            );

            const { insertSpy, valuesSpy } = buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act
            await handlePlanChange(ctx as unknown as Context);

            // Assert — insert was called on billingSubscriptionEvents
            expect(insertSpy).toHaveBeenCalledTimes(1);
            expect(valuesSpy).toHaveBeenCalledTimes(1);

            const insertedRow = valuesSpy.mock.calls[0]![0] as Record<string, unknown>;
            expect(insertedRow.eventType).toBe('PLAN_CHANGE_LOCAL_FAILED');
        });

        it('should record subscriptionId from the QZPay changePlan result in the compensating event', async () => {
            // Arrange
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(withServiceTransaction).mockRejectedValue(new Error('transaction rollback'));

            const { valuesSpy } = buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act
            await handlePlanChange(ctx as unknown as Context);

            // Assert — subscriptionId matches what changePlan returned
            const insertedRow = valuesSpy.mock.calls[0]![0] as Record<string, unknown>;
            expect(insertedRow.subscriptionId).toBe(SUBSCRIPTION_ID);
        });

        it('should include oldPlanId, newPlanId, and error message in metadata', async () => {
            // Arrange
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );

            const localError = new Error('addon limits recalculation failed: row lock timeout');
            vi.mocked(withServiceTransaction).mockRejectedValue(localError);

            const { valuesSpy } = buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act
            await handlePlanChange(ctx as unknown as Context);

            // Assert — metadata contains all required fields
            const insertedRow = valuesSpy.mock.calls[0]![0] as {
                metadata: {
                    oldPlanId: string;
                    newPlanId: string;
                    error: string;
                };
            };

            expect(insertedRow.metadata.oldPlanId).toBe(OLD_PLAN_ID);
            expect(insertedRow.metadata.newPlanId).toBe(NEW_PLAN_ID);
            expect(insertedRow.metadata.error).toBe(localError.message);
        });

        it('should set triggerSource to "plan-change-compensating" in the compensating event', async () => {
            // Arrange
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(withServiceTransaction).mockRejectedValue(new Error('tx timeout'));

            const { valuesSpy } = buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act
            await handlePlanChange(ctx as unknown as Context);

            // Assert
            const insertedRow = valuesSpy.mock.calls[0]![0] as Record<string, unknown>;
            expect(insertedRow.triggerSource).toBe('plan-change-compensating');
        });

        it('should NOT re-throw the local error (route returns success since QZPay succeeded)', async () => {
            // Arrange
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(withServiceTransaction).mockRejectedValue(
                new Error('local transaction failed')
            );

            buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act & Assert — must resolve, not reject
            await expect(handlePlanChange(ctx as unknown as Context)).resolves.not.toThrow();
        });

        it('should return a response with subscriptionId and newPlanId despite the local failure', async () => {
            // Arrange
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(withServiceTransaction).mockRejectedValue(new Error('local tx error'));

            buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act
            const result = await handlePlanChange(ctx as unknown as Context);

            // Assert — caller receives the plan change confirmation
            expect(result).toMatchObject({
                subscriptionId: SUBSCRIPTION_ID,
                newPlanId: NEW_PLAN_ID,
                previousPlanId: OLD_PLAN_ID
            });
        });

        it('should use the top-level getDb() for the insert, not the rolled-back transaction', async () => {
            // Arrange — withServiceTransaction simulates inner TX rollback and throws
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(withServiceTransaction).mockRejectedValue(new Error('rollback'));

            const { insertSpy } = buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act
            await handlePlanChange(ctx as unknown as Context);

            // Assert — getDb() was called AFTER withServiceTransaction threw
            // (i.e. the insert uses the top-level connection, not the tx)
            expect(getDb).toHaveBeenCalled();
            expect(insertSpy).toHaveBeenCalled();
        });
    });

    // ─── Non-string errors (stringification) ──────────────────────────────────

    describe('when the local transaction throws a non-Error value', () => {
        it('should stringify the thrown value as the error message in metadata', async () => {
            // Arrange
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );

            // Throw a non-Error (plain string)
            vi.mocked(withServiceTransaction).mockRejectedValue('unexpected string rejection');

            const { valuesSpy } = buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act
            await handlePlanChange(ctx as unknown as Context);

            // Assert — error field should be the stringified value
            const insertedRow = valuesSpy.mock.calls[0]![0] as { metadata: { error: string } };
            expect(insertedRow.metadata.error).toBe('unexpected string rejection');
        });
    });

    // ─── Happy path: no compensating event when transaction succeeds ───────────

    describe('when both QZPay and local transaction succeed', () => {
        it('should NOT insert any compensating event', async () => {
            // Arrange
            const billing = buildBillingMock({
                currentPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                subscriptionId: SUBSCRIPTION_ID
            });
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );

            // withServiceTransaction succeeds by calling the callback
            vi.mocked(withServiceTransaction).mockImplementation((async (
                cb: (ctx: unknown) => Promise<unknown>
            ) => {
                await cb({ tx: {}, hookState: {} });
            }) as unknown as typeof withServiceTransaction);
            vi.mocked(handlePlanChangeAddonRecalculation).mockResolvedValue(
                undefined as unknown as PlanChangeRecalculationResult
            );

            const { insertSpy } = buildDbMockWithInsertSpy();
            const ctx = buildContext({
                body: { newPlanId: NEW_PLAN_ID, billingInterval: 'monthly' }
            });

            // Act
            await handlePlanChange(ctx as unknown as Context);

            // Assert — no compensating event inserted
            expect(insertSpy).not.toHaveBeenCalled();
        });
    });
});
