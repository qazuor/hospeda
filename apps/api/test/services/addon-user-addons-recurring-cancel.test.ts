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
    mockDbSelectRows
} = vi.hoisted(() => ({
    mockCloseAddonPreapproval: vi.fn(),
    mockCancelAddonPurchaseRecord: vi.fn().mockResolvedValue(1),
    mockAddonCatalogGetBySlug: vi.fn(),
    mockRemoveAddonEntitlements: vi.fn().mockResolvedValue({ success: true }),
    /** Captures every `update(...).set(payload)` inside the transaction. */
    mockTxUpdateSet: vi.fn(),
    /** Row the purchase lookup answers with. */
    mockDbSelectRows: { rows: [] as Array<Record<string, unknown>> }
}));

vi.mock('../../src/services/addon-preapproval-cancel', () => ({
    closeAddonPreapproval: mockCloseAddonPreapproval
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

vi.mock('@repo/notifications', () => ({
    NotificationType: { ADDON_CANCELLATION: 'ADDON_CANCELLATION' }
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

const dbStub = () => {
    const selectChain = {
        from: vi.fn(() => selectChain),
        where: vi.fn(() => selectChain),
        limit: vi.fn(() => Promise.resolve(mockDbSelectRows.rows))
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
    withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({}))
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

import { cancelUserAddon } from '../../src/services/addon.user-addons.js';

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

/** Seeds the purchase lookup with a row carrying (or not) a preapproval. */
function seedPurchase(mpSubscriptionId: string | null): void {
    mockDbSelectRows.rows = [
        {
            id: PURCHASE_ID,
            addonSlug: LIMIT_ADDON_DEF.slug,
            status: 'active',
            customerId: CUSTOMER_ID,
            mpSubscriptionId
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

        // The three ways this function can make a purchase terminal or
        // benefit-less. None may fire.
        expect(mockTxUpdateSet).not.toHaveBeenCalled();
        expect(mockCancelAddonPurchaseRecord).not.toHaveBeenCalled();
        expect(mockRemoveAddonEntitlements).not.toHaveBeenCalled();
    });

    it('CONTROL: the same input writes the terminal row once MercadoPago accepts', async () => {
        // Without this the assertions above would also pass against a
        // cancelUserAddon that had been gutted into a no-op.
        seedPurchase(PREAPPROVAL_ID);
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });

        const result = await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        expect(result.success).toBe(true);
        expect(mockTxUpdateSet).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'canceled' })
        );
        expect(mockRemoveAddonEntitlements).toHaveBeenCalled();
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

    it('closes the provider BEFORE the first local write, not after', async () => {
        seedPurchase(PREAPPROVAL_ID);
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });

        await cancelUserAddon(billing, entitlementService, CANCEL_INPUT);

        // An "after" ordering leaves a crash window in precisely the forbidden
        // state, so the order is part of the contract, not an accident of
        // layout.
        const closeOrder = mockCloseAddonPreapproval.mock.invocationCallOrder[0] ?? 0;
        const writeOrder = mockTxUpdateSet.mock.invocationCallOrder[0] ?? 0;
        expect(closeOrder).toBeGreaterThan(0);
        expect(writeOrder).toBeGreaterThan(closeOrder);
    });

    it('still cancels a one-time add-on, which has no preapproval to close', async () => {
        // The overwhelmingly common case. A regression here would break every
        // existing add-on cancellation, so it is asserted rather than assumed.
        seedPurchase(null);
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
    });
});
