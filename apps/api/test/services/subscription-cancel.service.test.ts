/**
 * Unit tests for softCancelSubscription (SPEC-147 T-005).
 *
 * RED-FIRST: written before the service implementation. All tests below will
 * fail until apps/api/src/services/subscription-cancel.service.ts is written.
 *
 * Cases:
 *  1. Happy path — cancel called with cancelAtPeriodEnd:true + reason; local
 *     row updated with cancelAtPeriodEnd=true; status stays active; event
 *     written; cache cleared; notification queued.
 *  2. Idempotent no-op — sub already has cancelAtPeriodEnd=true → no provider
 *     call, no event, no notification; returns success.
 *  3. Wrong-customer guard — sub belongs to different customer → ServiceError.
 *  4. Non-active sub rejected — sub in 'cancelled' state → ServiceError.
 *  5. Provider error (QZPayProviderSyncError) → mapped ServiceError surfaces,
 *     not swallowed.
 *  6. Notification send failure does NOT break the cancel (soft fire-and-forget).
 *
 * @module test/services/subscription-cancel.service
 */

import { QZPayProviderSyncError } from '@qazuor/qzpay-core';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles for mutable overrides in individual tests
// ---------------------------------------------------------------------------

const { mockBillingCancelFn, mockDbSelectFn, mockDbUpdateFn, mockDbInsertFn, mockDbTransactionFn } =
    vi.hoisted(() => {
        // Initial placeholder chain — overridden per-test via setupDbSelectRow.
        const mockSelectChain = {
            from: vi.fn(),
            where: vi.fn(),
            for: vi.fn()
        };

        // select() returns an object with .from()
        const mockDbSelectFn = vi.fn(() => mockSelectChain);

        // update().set().where()
        const mockDbUpdateWhere = vi.fn().mockResolvedValue([]);
        const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
        const mockDbUpdateFn = vi.fn(() => ({ set: mockDbUpdateSet }));

        // insert().values()
        const mockDbInsertValues = vi.fn().mockResolvedValue([]);
        const mockDbInsertFn = vi.fn(() => ({ values: mockDbInsertValues }));

        // transaction callback wrapper
        const mockDbTransactionFn = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
            return cb({ select: mockDbSelectFn, update: mockDbUpdateFn, insert: mockDbInsertFn });
        });

        const mockBillingCancelFn = vi.fn();

        return {
            mockBillingCancelFn,
            mockDbSelectFn,
            mockDbUpdateFn,
            mockDbInsertFn,
            mockDbTransactionFn
        };
    });

// ---------------------------------------------------------------------------
// Module mocks — declared before imports
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: mockDbSelectFn,
        update: mockDbUpdateFn,
        insert: mockDbInsertFn,
        transaction: mockDbTransactionFn
    })),
    billingSubscriptions: {
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        cancelAtPeriodEnd: 'cancel_at_period_end',
        canceledAt: 'canceled_at',
        currentPeriodEnd: 'current_period_end',
        planId: 'plan_id',
        updatedAt: 'updated_at'
    },
    billingSubscriptionEvents: {
        subscriptionId: 'subscription_id',
        eventType: 'event_type',
        triggerSource: 'trigger_source',
        metadata: 'metadata'
    },
    eq: vi.fn((_a: unknown, _b: unknown) => ({ _eq: true }))
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    const { getDb } = await import('@repo/db');
    return {
        ...actual,
        withServiceTransaction: vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
            const db = getDb() as {
                transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
            };
            return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
        })
    };
});

vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return {
        ...actual,
        ServiceErrorCode: {
            ...actual.ServiceErrorCode
        },
        SubscriptionStatusEnum: {
            ACTIVE: 'active',
            TRIALING: 'trialing',
            PAST_DUE: 'past_due',
            PAUSED: 'paused',
            CANCELLED: 'cancelled',
            EXPIRED: 'expired',
            PENDING_PROVIDER: 'pending_provider',
            ABANDONED: 'abandoned'
        }
    };
});

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/lib/billing-provider-error', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/lib/billing-provider-error')>();
    return { ...actual };
});

vi.mock('../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/lib/sentry')>();
    return { ...actual, captureBillingError: vi.fn() };
});

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { getDb } from '@repo/db';
import { withServiceTransaction } from '@repo/service-core';
import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { softCancelSubscription } from '../../src/services/subscription-cancel.service';
import { sendNotification } from '../../src/utils/notification-helper';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUB_ID = 'sub-test-001';
const CUSTOMER_ID = 'cus-test-001';
const OTHER_CUSTOMER_ID = 'cus-other-002';
const PLAN_ID = 'plan-standard-uuid';
const CURRENT_PERIOD_END = new Date('2026-07-15T23:59:59.000Z');
const CANCELED_AT = new Date('2026-06-09T10:00:00.000Z');

interface SubRow {
    id: string;
    customerId: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    currentPeriodEnd: Date;
    planId: string;
}

/** Default healthy active subscription row (DB format). */
function buildSubRow(overrides: Partial<SubRow> = {}): SubRow {
    return {
        id: SUB_ID,
        customerId: CUSTOMER_ID,
        status: 'active',
        cancelAtPeriodEnd: false,
        canceledAt: null,
        currentPeriodEnd: CURRENT_PERIOD_END,
        planId: PLAN_ID,
        ...overrides
    };
}

/** Minimal billing instance mock. */
function buildBillingMock(cancelResult?: SubRow) {
    const result = cancelResult ?? {
        ...buildSubRow(),
        canceledAt: CANCELED_AT,
        cancelAtPeriodEnd: false // qzpay-core doesn't set this
    };

    mockBillingCancelFn.mockResolvedValue(result);

    return {
        subscriptions: {
            cancel: mockBillingCancelFn
        }
    };
}

/**
 * Wires the DB mock so:
 *  - The first SELECT (initial row lookup outside tx) returns the given row.
 *  - The FOR UPDATE SELECT inside the tx returns the same row.
 *
 * The chain for both reads:
 *   db.select(...).from(billingSubscriptions).where(eq(...)).for('update')
 */
function setupDbSelectRow(row: SubRow | null): void {
    const resolvedRows = row ? [row] : [];

    // SELECT chain: select().from().where().for('update') → resolves rows
    const forUpdate = vi.fn().mockResolvedValue(resolvedRows);
    const where = vi.fn(() => ({ for: forUpdate }));
    const from = vi.fn(() => ({ where }));

    // Cast: mock chain deliberately omits .where/.for at the top level —
    // those are available via .from() chain only, matching the SUT call pattern.
    mockDbSelectFn.mockReturnValue({ from } as ReturnType<typeof mockDbSelectFn>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('softCancelSubscription', () => {
    let billing: ReturnType<typeof buildBillingMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        billing = buildBillingMock();

        // Default: withServiceTransaction is already wired in vi.mock above.
        // Reset it so fresh db mock state is picked up after clearAllMocks.
        // Cast is necessary because the vi.mocked() type infers the strict
        // ServiceContext parameter; we intentionally pass unknown to keep the
        // test helper simple.
        (
            vi.mocked(withServiceTransaction) as unknown as {
                mockImplementation: (
                    fn: (cb: (ctx: unknown) => Promise<unknown>) => Promise<unknown>
                ) => void;
            }
        ).mockImplementation(async (cb: (ctx: unknown) => Promise<unknown>) => {
            const db = getDb() as {
                transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
            };
            return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
        });

        // Default: update().set().where() resolves successfully
        const mockDbUpdateWhere = vi.fn().mockResolvedValue([]);
        const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
        mockDbUpdateFn.mockReturnValue({ set: mockDbUpdateSet });

        // Default: insert().values() resolves successfully
        const mockDbInsertValues = vi.fn().mockResolvedValue([]);
        mockDbInsertFn.mockReturnValue({ values: mockDbInsertValues });

        // Default subscription row: active, not yet soft-cancelled
        setupDbSelectRow(buildSubRow());
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ── 1. Happy path ─────────────────────────────────────────────────────────

    describe('happy path', () => {
        it('calls billing.subscriptions.cancel with cancelAtPeriodEnd:true and reason', async () => {
            const result = await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID,
                reason: 'too expensive'
            });

            expect(result.subscriptionId).toBe(SUB_ID);
            expect(result.cancelAtPeriodEnd).toBe(true);
            expect(mockBillingCancelFn).toHaveBeenCalledOnce();
            expect(mockBillingCancelFn).toHaveBeenCalledWith(SUB_ID, {
                cancelAtPeriodEnd: true,
                reason: 'too expensive'
            });
        });

        it('writes cancelAtPeriodEnd=true to the local billing_subscriptions row', async () => {
            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            });

            expect(mockDbUpdateFn).toHaveBeenCalled();
            // The set() call should include cancelAtPeriodEnd: true
            const setCall = mockDbUpdateFn.mock.results[0]?.value;
            expect(setCall.set).toHaveBeenCalledWith(
                expect.objectContaining({ cancelAtPeriodEnd: true })
            );
        });

        it('does NOT flip status — subscription stays active after soft cancel', async () => {
            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            });

            const setCall = mockDbUpdateFn.mock.results[0]?.value;
            const setArg = setCall.set.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setArg.status).toBeUndefined();
        });

        it('inserts a USER_CANCELED billing_subscription_events row', async () => {
            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID,
                reason: 'changing plans'
            });

            expect(mockDbInsertFn).toHaveBeenCalled();
            const insertResult = mockDbInsertFn.mock.results[0]?.value;
            expect(insertResult.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'USER_CANCELED',
                    triggerSource: 'user-cancel'
                })
            );
        });

        it('sets metadata.preapprovalPaused=true on the event row', async () => {
            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID,
                reason: 'too expensive'
            });

            const insertResult = mockDbInsertFn.mock.results[0]?.value;
            const valuesArg = insertResult.values.mock.calls[0]?.[0] as {
                metadata?: { preapprovalPaused?: boolean; reason?: string };
            };
            expect(valuesArg.metadata?.preapprovalPaused).toBe(true);
        });

        it('includes reason in event metadata when provided', async () => {
            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID,
                reason: 'too expensive'
            });

            const insertResult = mockDbInsertFn.mock.results[0]?.value;
            const valuesArg = insertResult.values.mock.calls[0]?.[0] as {
                metadata?: { reason?: string };
            };
            expect(valuesArg.metadata?.reason).toBe('too expensive');
        });

        it('calls clearEntitlementCache with the customer id', async () => {
            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            });

            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('queues SUBSCRIPTION_CANCEL_CONFIRMED notification', async () => {
            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID,
                recipientEmail: 'owner@example.com',
                recipientName: 'Test Owner',
                planName: 'Plan Standard',
                userId: 'user-001',
                baseUrl: 'https://hospeda.com.ar'
            });

            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscription_cancel_confirmed',
                    planName: 'Plan Standard'
                })
            );
        });

        it('returns subscriptionId, cancelAtPeriodEnd:true, canceledAt, accessUntil', async () => {
            billing = buildBillingMock({
                ...buildSubRow(),
                canceledAt: CANCELED_AT
            });

            const result = await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            });

            expect(result.subscriptionId).toBe(SUB_ID);
            expect(result.cancelAtPeriodEnd).toBe(true);
            expect(result.canceledAt).toBeInstanceOf(Date);
            expect(result.accessUntil).toBeInstanceOf(Date);
        });
    });

    // ── 2. Idempotent no-op ───────────────────────────────────────────────────

    describe('idempotent no-op when already soft-cancelled', () => {
        it('returns success without calling provider cancel', async () => {
            setupDbSelectRow(buildSubRow({ cancelAtPeriodEnd: true, canceledAt: CANCELED_AT }));

            const result = await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            });

            expect(result.cancelAtPeriodEnd).toBe(true);
            expect(mockBillingCancelFn).not.toHaveBeenCalled();
        });

        it('does NOT send a second notification on duplicate call', async () => {
            setupDbSelectRow(buildSubRow({ cancelAtPeriodEnd: true, canceledAt: CANCELED_AT }));

            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            });

            expect(sendNotification).not.toHaveBeenCalled();
        });

        it('does NOT write a duplicate event row', async () => {
            setupDbSelectRow(buildSubRow({ cancelAtPeriodEnd: true, canceledAt: CANCELED_AT }));

            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            });

            expect(mockDbInsertFn).not.toHaveBeenCalled();
        });
    });

    // ── 3. Wrong-customer guard ───────────────────────────────────────────────

    describe('ownership guard', () => {
        it('throws ServiceError when sub belongs to a different customer', async () => {
            setupDbSelectRow(buildSubRow({ customerId: OTHER_CUSTOMER_ID }));

            await expect(
                softCancelSubscription({
                    billing: billing as never,
                    subscriptionId: SUB_ID,
                    customerId: CUSTOMER_ID
                })
            ).rejects.toThrow(ServiceError);
        });

        it('does not call provider cancel when ownership check fails', async () => {
            setupDbSelectRow(buildSubRow({ customerId: OTHER_CUSTOMER_ID }));

            await expect(
                softCancelSubscription({
                    billing: billing as never,
                    subscriptionId: SUB_ID,
                    customerId: CUSTOMER_ID
                })
            ).rejects.toThrow();

            expect(mockBillingCancelFn).not.toHaveBeenCalled();
        });

        it('throws with AUTHORIZATION_ERROR code on ownership mismatch', async () => {
            setupDbSelectRow(buildSubRow({ customerId: OTHER_CUSTOMER_ID }));

            let caught: unknown;
            try {
                await softCancelSubscription({
                    billing: billing as never,
                    subscriptionId: SUB_ID,
                    customerId: CUSTOMER_ID
                });
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(ServiceError);
            expect((caught as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ── 4. Non-active sub rejected ────────────────────────────────────────────

    describe('non-active subscription rejected', () => {
        it.each(['cancelled', 'expired', 'paused', 'pending_provider', 'abandoned'])(
            'throws ServiceError for status=%s',
            async (status) => {
                setupDbSelectRow(buildSubRow({ status }));

                await expect(
                    softCancelSubscription({
                        billing: billing as never,
                        subscriptionId: SUB_ID,
                        customerId: CUSTOMER_ID
                    })
                ).rejects.toThrow(ServiceError);
            }
        );

        it('accepts trialing status (soft-cancellable)', async () => {
            setupDbSelectRow(buildSubRow({ status: 'trialing' }));
            billing = buildBillingMock({
                ...buildSubRow({ status: 'trialing' }),
                canceledAt: CANCELED_AT
            });

            await expect(
                softCancelSubscription({
                    billing: billing as never,
                    subscriptionId: SUB_ID,
                    customerId: CUSTOMER_ID
                })
            ).resolves.toBeDefined();
        });

        it('throws NOT_FOUND when subscription row is missing', async () => {
            setupDbSelectRow(null);

            let caught: unknown;
            try {
                await softCancelSubscription({
                    billing: billing as never,
                    subscriptionId: SUB_ID,
                    customerId: CUSTOMER_ID
                });
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(ServiceError);
            expect((caught as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    // ── 5. Provider error surfaces as mapped ServiceError ─────────────────────

    describe('provider error handling', () => {
        it('re-throws a ServiceError when billing.cancel throws QZPayProviderSyncError', async () => {
            // QZPayProviderSyncError(message, provider, operation, metadata?, cause?)
            const causeErr = Object.assign(new Error('service unavailable'), { status: 503 });
            const providerErr = new QZPayProviderSyncError(
                'MP preapproval pause failed',
                'mercadopago',
                'subscription_cancel',
                {},
                causeErr
            );
            mockBillingCancelFn.mockRejectedValue(providerErr);
            billing = {
                subscriptions: { cancel: mockBillingCancelFn }
            };

            await expect(
                softCancelSubscription({
                    billing: billing as never,
                    subscriptionId: SUB_ID,
                    customerId: CUSTOMER_ID
                })
            ).rejects.toThrow(ServiceError);
        });

        it('does NOT swallow the error — it surfaces to the caller', async () => {
            // status 504 on the cause → maps to PROVIDER_TIMEOUT
            const causeErr = Object.assign(new Error('gateway timeout'), { status: 504 });
            const providerErr = new QZPayProviderSyncError(
                'Timeout',
                'mercadopago',
                'subscription_cancel',
                {},
                causeErr
            );
            mockBillingCancelFn.mockRejectedValue(providerErr);
            billing = { subscriptions: { cancel: mockBillingCancelFn } };

            let caught: unknown;
            try {
                await softCancelSubscription({
                    billing: billing as never,
                    subscriptionId: SUB_ID,
                    customerId: CUSTOMER_ID
                });
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(ServiceError);
            expect((caught as ServiceError).code).toBe(ServiceErrorCode.PROVIDER_TIMEOUT);
        });
    });

    // ── 6. Notification failure is soft ──────────────────────────────────────

    describe('notification failure is non-blocking', () => {
        it('completes the cancel even when sendNotification rejects', async () => {
            vi.mocked(sendNotification).mockRejectedValue(new Error('smtp down'));

            // Should NOT throw
            const result = await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID,
                recipientEmail: 'owner@example.com',
                recipientName: 'Test Owner',
                planName: 'Plan Standard',
                userId: 'user-001',
                baseUrl: 'https://hospeda.com.ar'
            });

            expect(result.cancelAtPeriodEnd).toBe(true);
        });

        it('still clears the cache even when notification fails', async () => {
            vi.mocked(sendNotification).mockRejectedValue(new Error('brevo down'));

            await softCancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID,
                recipientEmail: 'owner@example.com',
                recipientName: 'Test Owner',
                planName: 'Plan Standard',
                userId: 'user-001',
                baseUrl: 'https://hospeda.com.ar'
            });

            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });
});
