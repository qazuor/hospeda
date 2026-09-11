/**
 * `cancelUserAddon` fails CLOSED when MercadoPago refuses to cancel the add-on's
 * preapproval (HOS-847 PR 6).
 *
 * ## The state these tests exist to make unreachable
 *
 * A `billing_addon_purchases` row at `status = 'canceled'` whose
 * `mp_subscription_id` still points at an authorized preapproval. Nothing can
 * recover it: the add-on's preapproval is absent from `billing_subscriptions`,
 * so no plan-side sweep sees it, and every add-on sweep filters on
 * `status = 'active'`, which the write just excluded. MercadoPago goes on
 * charging a card for an add-on the platform believes was cancelled — HOS-751,
 * one table over.
 *
 * ## Why there is a control case in every "nothing happened" test
 *
 * An assertion that the UPDATE was NOT called passes just as happily against a
 * `cancelUserAddon` that was gutted and does nothing at all. Each refusal test
 * is therefore paired with the same input under an ACCEPTED close, where the
 * very same write must happen.
 *
 * @module test/services/addon-user-addons-recurring-cancel
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks — must be declared before the import under test ─────────────

const {
    mockCloseAddonPreapproval,
    mockCancelAddonPurchaseRecord,
    mockAddonCatalogGetBySlug,
    mockRemoveAddonEntitlements,
    mockTxUpdateSet,
    mockDbSelectRows,
    mockLockedRows,
    mockSoftCancel
} = vi.hoisted(() => ({
    mockSoftCancel: vi.fn(),
    mockCloseAddonPreapproval: vi.fn(),
    mockCancelAddonPurchaseRecord: vi.fn().mockResolvedValue(1),
    mockAddonCatalogGetBySlug: vi.fn(),
    mockRemoveAddonEntitlements: vi.fn().mockResolvedValue({ success: true }),
    /** Captures every `update(...).set(payload)` inside the transaction. */
    mockTxUpdateSet: vi.fn(),
    /** Rows the purchase lookup (and the bulk pre-lock read) answer with. */
    mockDbSelectRows: { rows: [] as Array<Record<string, unknown>> },
    /** Rows the bulk revoke's `SELECT ... FOR UPDATE` answers with. */
    mockLockedRows: { rows: [] as Array<Record<string, unknown>> }
}));

vi.mock('../../src/services/addon-preapproval-cancel', () => ({
    closeAddonPreapproval: mockCloseAddonPreapproval
}));

// The soft-cancel write itself has its own suite (addon-soft-cancel.test.ts);
// here it is mocked so these tests can assert WHETHER and WITH WHAT it was
// reached, which is the branching decision under test.
vi.mock('../../src/services/addon-soft-cancel', () => ({
    softCancelRecurringAddon: mockSoftCancel
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

vi.mock('../../src/services/addon-limit-recalculation.service', () => ({
    recalculateAddonLimitsForCustomer: vi
        .fn()
        .mockResolvedValue({ outcome: 'updated', newMaxValue: 1, addonCount: 0 })
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/notification-recipient-locale', () => ({
    resolveRecipientLocale: vi.fn().mockResolvedValue('es')
}));

// The member carries its REAL value. A stand-in string would make any
// assertion on the emitted `payload.type` a comparison against this file's own
// invention rather than against what the dispatcher receives.
vi.mock('@repo/notifications', () => ({
    NotificationType: { ADDON_CANCELLATION: 'addon_cancellation' }
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        addonSlug: 'addon_slug',
        mpSubscriptionId: 'mp_subscription_id',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    }
}));

/**
 * A `where(...)` result that BOTH awaits to the rows (the bulk pre-read, which
 * has no `.limit()`) and offers `.limit()` (the single-purchase lookup).
 */
const awaitableQuery = (rows: unknown[]) => {
    const settled = Promise.resolve(rows) as Promise<unknown[]> & {
        limit: () => Promise<unknown[]>;
    };
    settled.limit = () => Promise.resolve(rows);
    return settled;
};

const dbStub = () => {
    const selectChain = {
        from: vi.fn(() => selectChain),
        where: vi.fn(() => awaitableQuery(mockDbSelectRows.rows))
    };
    return { select: vi.fn(() => selectChain) };
};

vi.mock('@repo/db/client', () => ({
    getDb: vi.fn(() => dbStub()),
    withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
            update: vi.fn(() => ({
                set: vi.fn((payload: unknown) => {
                    mockTxUpdateSet(payload);
                    return { where: vi.fn(async () => ({ rowCount: 1 })) };
                })
            }))
        })
    )
}));

vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    getDb: vi.fn(() => dbStub()),
    withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        // The bulk revoke's `SELECT ... FOR UPDATE` goes through `tx.execute`,
        // and answers with the SAME rows as the pre-lock read unless a test
        // makes them diverge.
        callback({
            execute: vi.fn(async () => ({ rows: mockLockedRows.rows }))
        })
    )
}));

vi.mock('@repo/service-core', () => ({
    BILLING_EVENT_TYPES: { ADDON_REVOCATIONS_PENDING: 'addon_revocations_pending' },
    cancelAddonPurchaseRecord: mockCancelAddonPurchaseRecord,
    queryUserAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
    queryAddonActive: vi.fn().mockResolvedValue({ success: true, data: false }),
    AddonCatalogService: vi.fn().mockImplementation(function () {
        return {
            getBySlug: mockAddonCatalogGetBySlug,
            list: vi.fn().mockResolvedValue({ success: true, data: [] })
        };
    })
}));

import {
    cancelUserAddon,
    revokeAllAddonsForCustomer
} from '../../src/services/addon.user-addons.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cus_hos847';
const PURCHASE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PREAPPROVAL_ID = 'preapproval-hos847';

/** A recurring add-on that affects a limit — the transactional write path. */
const LIMIT_ADDON_DEF = {
    slug: 'extra-accommodations-20',
    name: 'Extra Accommodations',
    billingType: 'recurring' as const,
    priceArs: 800000,
    affectsLimitKey: 'max_accommodations',
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

const CANCEL_INPUT = {
    customerId: CUSTOMER_ID,
    purchaseId: PURCHASE_ID,
    userId: 'user_hos847',
    reason: 'no longer needed'
};

/** End of the period the customer already paid for. */
const PERIOD_END = new Date('2026-10-01T00:00:00.000Z');

/**
 * Seeds the purchase lookup.
 *
 * `mpSubscriptionId` is what makes a purchase RECURRING; `currentPeriodEnd` is
 * what makes it cancellable at the end of the paid period. A recurring row
 * without the date is a real (if unexpected) shape, so it is expressible here.
 */
function seedPurchase(
    mpSubscriptionId: string | null,
    currentPeriodEnd: Date | null = PERIOD_END
): void {
    mockDbSelectRows.rows = [
        {
            id: PURCHASE_ID,
            addonSlug: LIMIT_ADDON_DEF.slug,
            status: 'active',
            customerId: CUSTOMER_ID,
            mpSubscriptionId,
            currentPeriodEnd
        }
    ];
}

const billing = {
    customers: { get: vi.fn().mockResolvedValue(null) },
    subscriptions: { getByCustomerId: vi.fn() },
    limits: { set: vi.fn(), removeBySource: vi.fn() }
} as unknown as QZPayBilling;

const entitlementService = {
    removeAddonEntitlements: mockRemoveAddonEntitlements
} as unknown as Parameters<typeof cancelUserAddon>[1];

describe('cancelUserAddon — MercadoPago closes first, or nothing happens', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCancelAddonPurchaseRecord.mockResolvedValue(1);
        mockRemoveAddonEntitlements.mockResolvedValue({ success: true });
        mockAddonCatalogGetBySlug.mockResolvedValue({ success: true, data: LIMIT_ADDON_DEF });
        mockSoftCancel.mockResolvedValue({ success: true, data: undefined });
    });

    it('leaves the local row untouched when MercadoPago rejects the cancel', async () => {
        seedPurchase(PREAPPROVAL_ID);
        mockCloseAddonPreapproval.mockResolvedValue({
            closed: false,
            reason: 'MP responded 400'
        });

        const result = await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        expect(result.success).toBe(false);
        // 503, not 500: the caller should retry, and nothing was changed.
        expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');

        // Every way this function can touch the purchase or the benefit. None
        // may fire — not the terminal write, not the soft-cancel flag.
        expect(mockSoftCancel).not.toHaveBeenCalled();
        expect(mockTxUpdateSet).not.toHaveBeenCalled();
        expect(mockCancelAddonPurchaseRecord).not.toHaveBeenCalled();
        expect(mockRemoveAddonEntitlements).not.toHaveBeenCalled();
    });

    it('CONTROL: the same input soft-cancels once MercadoPago accepts', async () => {
        // Without this the assertions above would also pass against a
        // cancelUserAddon that had been gutted into a no-op.
        seedPurchase(PREAPPROVAL_ID);
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });

        const result = await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        expect(result.success).toBe(true);
        expect(mockSoftCancel).toHaveBeenCalledWith(
            expect.objectContaining({
                purchaseId: PURCHASE_ID,
                addonSlug: LIMIT_ADDON_DEF.slug,
                addonName: LIMIT_ADDON_DEF.name,
                currentPeriodEnd: PERIOD_END
            })
        );
    });

    it('KEEPS the benefit: no terminal row, no limit recalculation, no entitlement removal', async () => {
        // The owner's decision, stated as three absences. The customer paid for
        // this period; cancelling stops the NEXT charge, not this period's
        // access. Any of these three firing would take it away the same day.
        seedPurchase(PREAPPROVAL_ID);
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });

        await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        expect(mockTxUpdateSet).not.toHaveBeenCalled();
        expect(mockCancelAddonPurchaseRecord).not.toHaveBeenCalled();
        expect(mockRemoveAddonEntitlements).not.toHaveBeenCalled();
        // ...and the control that keeps the three absences honest: something DID
        // happen.
        expect(mockSoftCancel).toHaveBeenCalledTimes(1);
    });

    it('REFUSES a recurring add-on with no current_period_end, before touching MercadoPago', async () => {
        // Ranked by the owner: "never expires" is worse than "expires now", and
        // both are worse than a visible error. Without a period end there is no
        // date to schedule the revocation for, so the benefit would be granted
        // forever. Refusing BEFORE the close also means the customer is not left
        // unhooked from billing by a request that then failed.
        seedPurchase(PREAPPROVAL_ID, null);

        const result = await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
        expect(mockCloseAddonPreapproval).not.toHaveBeenCalled();
        expect(mockSoftCancel).not.toHaveBeenCalled();
        expect(mockTxUpdateSet).not.toHaveBeenCalled();
    });

    it('asks the close helper about THIS purchase, naming the user-cancel path', async () => {
        seedPurchase(PREAPPROVAL_ID);
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });

        await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        expect(mockCloseAddonPreapproval).toHaveBeenCalledWith({
            purchase: {
                id: PURCHASE_ID,
                addonSlug: LIMIT_ADDON_DEF.slug,
                // Read straight off the row: this is the add-on's OWN
                // preapproval, never the customer's plan subscription.
                mpSubscriptionId: PREAPPROVAL_ID
            },
            source: 'user-cancel',
            billing
        });
    });

    it('closes the provider BEFORE flagging the row, not after', async () => {
        seedPurchase(PREAPPROVAL_ID);
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });

        await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        // An "after" ordering leaves a crash window in which the row promises an
        // end date that nothing at MercadoPago agreed to, so the order is part
        // of the contract, not an accident of layout.
        const closeOrder = mockCloseAddonPreapproval.mock.invocationCallOrder[0] ?? 0;
        const flagOrder = mockSoftCancel.mock.invocationCallOrder[0] ?? 0;
        expect(closeOrder).toBeGreaterThan(0);
        expect(flagOrder).toBeGreaterThan(closeOrder);
    });

    it('still cancels a one-time add-on IMMEDIATELY, which has no period to keep', async () => {
        // The overwhelmingly common case, and the half the owner's decision does
        // NOT change: no preapproval, no period, nothing paid ahead — so it is
        // still revoked on the spot. A regression here would break every
        // existing add-on cancellation, so it is asserted rather than assumed.
        seedPurchase(null, null);
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'no-preapproval' });

        const result = await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        expect(result.success).toBe(true);
        expect(mockCloseAddonPreapproval).toHaveBeenCalledWith(
            expect.objectContaining({
                purchase: expect.objectContaining({ mpSubscriptionId: null })
            })
        );
        expect(mockTxUpdateSet).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'canceled' })
        );
        expect(mockRemoveAddonEntitlements).toHaveBeenCalled();
        // The missing `current_period_end` above is deliberate: a one-time
        // add-on never has one, and must not be dragged into the recurring
        // refusal that requires it.
        expect(mockSoftCancel).not.toHaveBeenCalled();
    });

    it('CONTROL: the immediate cancellation email promises NO access (HOS-847 PR 7c)', async () => {
        // The counterpart of the soft-cancel assertion in
        // `addon-soft-cancel.test.ts`. This path has already removed the
        // entitlements by the time it mails, so an `accessUntil` here would
        // promise a benefit the customer no longer has — which is the entire
        // reason the payload field is OPTIONAL rather than required.
        seedPurchase(null, null);
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'no-preapproval' });
        // The shared `billing` stub resolves a null customer (every other test
        // here is about the DB writes, not the email); a real customer is what
        // gets the notification block past its own guard.
        vi.mocked(billing.customers.get).mockResolvedValue({
            id: 'cus_x',
            email: 'owner@example.com',
            metadata: { name: 'Marcos' }
        } as never);

        await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        const { sendNotification } = await import('../../src/utils/notification-helper');
        const call = vi.mocked(sendNotification).mock.calls[0];
        expect(call, 'the immediate cancellation must still mail the customer').toBeDefined();
        const payload = (call as unknown as [Record<string, unknown>])[0];
        // The value the real enum declares, not the mock's shorthand: the
        // dispatcher routes on this exact string.
        expect(payload.type).toBe('addon_cancellation');
        // `toHaveProperty` rather than a truthiness check: an `accessUntil` of
        // `undefined` would still be a field the dispatcher forwards, and this
        // must be the ABSENCE the template branches on.
        expect(payload).not.toHaveProperty('accessUntil');
    });
});

describe('revokeAllAddonsForCustomer — the close runs outside the row lock', () => {
    /** One recurring purchase, as both the pre-lock read and the locked read see it. */
    const RECURRING_ROW = {
        id: PURCHASE_ID,
        addonSlug: LIMIT_ADDON_DEF.slug,
        mpSubscriptionId: PREAPPROVAL_ID
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCancelAddonPurchaseRecord.mockResolvedValue(1);
        mockDbSelectRows.rows = [RECURRING_ROW];
        mockLockedRows.rows = [RECURRING_ROW];
    });

    it('cancels the purchase once its preapproval is closed', async () => {
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });

        const result = await revokeAllAddonsForCustomer({ customerId: CUSTOMER_ID });

        expect(result).toEqual({ revokedCount: 1, failedIds: [] });
        expect(mockCancelAddonPurchaseRecord).toHaveBeenCalledTimes(1);
        // Outside the lock, before it: ADR-019 forbids holding row locks across
        // third-party latency, so the ordering here is a constraint, not taste.
        const closeOrder = mockCloseAddonPreapproval.mock.invocationCallOrder[0] ?? 0;
        const cancelOrder = mockCancelAddonPurchaseRecord.mock.invocationCallOrder[0] ?? 0;
        expect(closeOrder).toBeGreaterThan(0);
        expect(cancelOrder).toBeGreaterThan(closeOrder);
    });

    it('reports the purchase as FAILED rather than cancelling it when the close is refused', async () => {
        mockCloseAddonPreapproval.mockResolvedValue({ closed: false, reason: 'MP 502' });

        const result = await revokeAllAddonsForCustomer({ customerId: CUSTOMER_ID });

        expect(result.revokedCount).toBe(0);
        expect(result.failedIds).toEqual([PURCHASE_ID]);
        expect(mockCancelAddonPurchaseRecord).not.toHaveBeenCalled();
    });

    it('skips a purchase that appeared only inside the lock, since nobody closed it', async () => {
        // The pre-lock read and the locked read can disagree: a purchase
        // activated in between exists only in the second. Cancelling it would
        // write the forbidden state — a terminal row over a preapproval no code
        // path ever called MercadoPago about.
        mockDbSelectRows.rows = [];
        mockLockedRows.rows = [RECURRING_ROW];
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });

        const result = await revokeAllAddonsForCustomer({ customerId: CUSTOMER_ID });

        expect(mockCloseAddonPreapproval).not.toHaveBeenCalled();
        expect(result.failedIds).toEqual([PURCHASE_ID]);
        expect(mockCancelAddonPurchaseRecord).not.toHaveBeenCalled();
    });

    it('CONTROL: a one-time purchase seen only inside the lock is still cancelled', async () => {
        // The skip above keys on `mp_subscription_id`, not on membership of the
        // pre-read. Without this case the rule would read as "anything the
        // pre-read missed is dropped", which would silently break the ordinary
        // account-deletion path for every one-time add-on.
        const oneTimeRow = { ...RECURRING_ROW, mpSubscriptionId: null };
        mockDbSelectRows.rows = [];
        mockLockedRows.rows = [oneTimeRow];

        const result = await revokeAllAddonsForCustomer({ customerId: CUSTOMER_ID });

        expect(result).toEqual({ revokedCount: 1, failedIds: [] });
        expect(mockCancelAddonPurchaseRecord).toHaveBeenCalledTimes(1);
    });
});
