/**
 * Unit tests for uncancelSubscription (HOS-232).
 *
 * The reverse of softCancelSubscription: re-authorizes the paused MercadoPago
 * preapproval via qzpay-core's `billing.subscriptions.uncancel()` and clears the
 * local `cancelAtPeriodEnd`/`canceledAt`, with no new checkout and no charge.
 *
 * Cases:
 *  1. Happy path — provider uncancel called; local row cleared
 *     (cancelAtPeriodEnd=false, canceledAt=null); event written; cache cleared.
 *  2. Idempotent no-op — sub already has cancelAtPeriodEnd=false → no provider
 *     call, no event; returns success.
 *  3. Not found → ServiceError NOT_FOUND.
 *  4. Wrong-customer guard → ServiceError FORBIDDEN.
 *  5. Non-uncancellable status (e.g. paused/cancelled) → ServiceError VALIDATION_ERROR.
 *  6. Provider error (QZPayProviderSyncError) → mapped ServiceError surfaces.
 *
 * @module test/services/subscription-uncancel.service
 */

import { QZPayProviderSyncError } from '@qazuor/qzpay-core';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles
// ---------------------------------------------------------------------------

const {
    mockBillingUncancelFn,
    mockDbSelectFn,
    mockDbUpdateFn,
    mockDbInsertFn,
    mockDbTransactionFn
} = vi.hoisted(() => {
    const mockSelectChain = { from: vi.fn(), where: vi.fn(), for: vi.fn() };
    const mockDbSelectFn = vi.fn(() => mockSelectChain);

    const mockDbUpdateWhere = vi.fn().mockResolvedValue([]);
    const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
    const mockDbUpdateFn = vi.fn(() => ({ set: mockDbUpdateSet }));

    const mockDbInsertValues = vi.fn().mockResolvedValue([]);
    const mockDbInsertFn = vi.fn(() => ({ values: mockDbInsertValues }));

    const mockDbTransactionFn = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({ select: mockDbSelectFn, update: mockDbUpdateFn, insert: mockDbInsertFn });
    });

    const mockBillingUncancelFn = vi.fn();

    return {
        mockBillingUncancelFn,
        mockDbSelectFn,
        mockDbUpdateFn,
        mockDbInsertFn,
        mockDbTransactionFn
    };
});

// ---------------------------------------------------------------------------
// Module mocks
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

vi.mock('../../src/middlewares/entitlement', () => ({ clearEntitlementCache: vi.fn() }));

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
import { uncancelSubscription } from '../../src/services/subscription-uncancel.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUB_ID = 'sub-test-001';
const CUSTOMER_ID = 'cus-test-001';
const OTHER_CUSTOMER_ID = 'cus-other-002';

interface SubRow {
    id: string;
    customerId: string;
    status: string;
    cancelAtPeriodEnd: boolean;
}

/** Default soft-cancelled subscription row (the un-cancellable state). */
function buildSubRow(overrides: Partial<SubRow> = {}): SubRow {
    return {
        id: SUB_ID,
        customerId: CUSTOMER_ID,
        status: 'active',
        cancelAtPeriodEnd: true,
        ...overrides
    };
}

function buildBillingMock() {
    mockBillingUncancelFn.mockResolvedValue(undefined);
    return { subscriptions: { uncancel: mockBillingUncancelFn } };
}

/** Wires the FOR UPDATE read: select().from().where().for('update'). */
function setupDbSelectRow(row: SubRow | null): void {
    const resolvedRows = row ? [row] : [];
    const forUpdate = vi.fn().mockResolvedValue(resolvedRows);
    const where = vi.fn(() => ({ for: forUpdate }));
    const from = vi.fn(() => ({ where }));
    mockDbSelectFn.mockReturnValue({ from } as ReturnType<typeof mockDbSelectFn>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uncancelSubscription', () => {
    let billing: ReturnType<typeof buildBillingMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        billing = buildBillingMock();
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
    });

    it('happy path: re-authorizes the preapproval, clears the flag, writes the event, clears cache', async () => {
        setupDbSelectRow(buildSubRow());

        const result = await uncancelSubscription({
            billing: billing as never,
            subscriptionId: SUB_ID,
            customerId: CUSTOMER_ID
        });

        expect(result).toEqual({ subscriptionId: SUB_ID, cancelAtPeriodEnd: false });
        // Provider re-authorization ran.
        expect(mockBillingUncancelFn).toHaveBeenCalledWith(SUB_ID);
        // Local flag + stamp cleared.
        expect(mockDbUpdateFn).toHaveBeenCalled();
        // Audit event written.
        expect(mockDbInsertFn).toHaveBeenCalled();
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('idempotent no-op when cancelAtPeriodEnd is already false (no provider call)', async () => {
        setupDbSelectRow(buildSubRow({ cancelAtPeriodEnd: false }));

        const result = await uncancelSubscription({
            billing: billing as never,
            subscriptionId: SUB_ID,
            customerId: CUSTOMER_ID
        });

        expect(result).toEqual({ subscriptionId: SUB_ID, cancelAtPeriodEnd: false });
        expect(mockBillingUncancelFn).not.toHaveBeenCalled();
        expect(mockDbUpdateFn).not.toHaveBeenCalled();
        expect(clearEntitlementCache).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when the subscription does not exist', async () => {
        setupDbSelectRow(null);

        await expect(
            uncancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(mockBillingUncancelFn).not.toHaveBeenCalled();
    });

    it('throws FORBIDDEN when the subscription belongs to another customer', async () => {
        setupDbSelectRow(buildSubRow({ customerId: OTHER_CUSTOMER_ID }));

        await expect(
            uncancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(mockBillingUncancelFn).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR for a non-uncancellable status (e.g. paused)', async () => {
        setupDbSelectRow(buildSubRow({ status: 'paused' }));

        await expect(
            uncancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.VALIDATION_ERROR });
        expect(mockBillingUncancelFn).not.toHaveBeenCalled();
    });

    it('maps a provider error to a ServiceError and does NOT clear the flag', async () => {
        setupDbSelectRow(buildSubRow());
        mockBillingUncancelFn.mockRejectedValueOnce(
            new QZPayProviderSyncError(
                'MP down',
                'mercadopago',
                'subscription_uncancel',
                {},
                new Error('MP down')
            )
        );

        await expect(
            uncancelSubscription({
                billing: billing as never,
                subscriptionId: SUB_ID,
                customerId: CUSTOMER_ID
            })
        ).rejects.toBeInstanceOf(ServiceError);
        // Fail-closed: local flag was NOT cleared.
        expect(mockDbUpdateFn).not.toHaveBeenCalled();
        expect(clearEntitlementCache).not.toHaveBeenCalled();
    });
});
