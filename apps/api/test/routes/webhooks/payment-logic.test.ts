/**
 * Tests for shared payment processing logic.
 * @module test/routes/webhooks/payment-logic
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendPaymentSuccessNotification: vi.fn().mockResolvedValue(undefined),
    sendPaymentFailureNotifications: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/routes/webhooks/mercadopago/utils', () => ({
    extractPaymentInfo: vi.fn().mockReturnValue(null),
    extractAddonMetadata: vi.fn().mockReturnValue(null),
    extractAddonFromReference: vi.fn().mockReturnValue(null),
    extractAnnualSubscriptionMetadata: vi.fn().mockReturnValue(null),
    extractPlanChangeUpgradeMetadata: vi.fn().mockReturnValue(null)
}));

// `@repo/db` mocked at module level so the annual confirmation flow's
// direct Drizzle reads/updates (status flip, payment dedupe) do not need
// a live Postgres. Each test overrides the per-call rows via the queue
// helpers below.
const annualDbState: {
    /**
     * Rows for select index 0 within a `getDb()` scope. Used by:
     *   - annual/plan-upgrade flows: `{ id, customerId, status }`
     *   - webhook refund flow (T-008): `{ id, customerId, subscriptionId, amount }`
     */
    subRows: Array<{
        id: string;
        customerId: string;
        status?: string;
        subscriptionId?: string | null;
        amount?: number;
    }>;
    paymentDedupeRows: Array<{ id: string }>;
    updateCalls: Array<{ table: unknown; values: unknown; whereCond: unknown }>;
} = {
    subRows: [],
    paymentDedupeRows: [],
    updateCalls: []
};

function resetAnnualDbState() {
    annualDbState.subRows = [];
    annualDbState.paymentDedupeRows = [];
    annualDbState.updateCalls.length = 0;
}

vi.mock('@repo/db', () => {
    let selectCount = 0;
    function makeSelectChain<T>(rows: T[]) {
        const chain = {
            from: () => chain,
            where: () => chain,
            limit: async () => rows
        };
        return chain;
    }
    function makeUpdateChain(table: unknown) {
        return {
            set(values: unknown) {
                return {
                    where(cond: unknown) {
                        annualDbState.updateCalls.push({ table, values, whereCond: cond });
                        return Promise.resolve(undefined);
                    }
                };
            }
        };
    }
    return {
        // EntityViewService singleton (service-core barrel) dereferences this at import.
        AccommodationModel: vi.fn(() => ({ findIdsByOwnerId: vi.fn(async () => []) })),
        entityViewModel: {
            insertView: vi.fn(),
            getStatsForEntities: vi.fn(async () => []),
            purgeOlderThan: vi.fn(async () => 0)
        },
        getDb: vi.fn(() => {
            selectCount = 0;
            return {
                select: vi.fn(() => {
                    const i = selectCount;
                    selectCount += 1;
                    const rows = i === 0 ? annualDbState.subRows : annualDbState.paymentDedupeRows;
                    return makeSelectChain(rows);
                }),
                update: vi.fn((t: unknown) => makeUpdateChain(t))
            };
        }),
        billingSubscriptions: {
            id: 'ID',
            customerId: 'CUSTOMER_ID',
            status: 'STATUS',
            deletedAt: 'DELETED_AT'
        },
        // billingPayments columns are read by confirmAnnualSubscription
        // (payment dedupe lookup), confirmPlanUpgrade, and the webhook refund
        // lifecycle (T-008 local payment lookup). The mocked select chain
        // ignores the column object shape — these are just sentinels so the
        // SQL template literal does not throw on property access.
        billingPayments: {
            id: 'PAYMENT_ID',
            customerId: 'CUSTOMER_ID',
            subscriptionId: 'SUBSCRIPTION_ID',
            amount: 'AMOUNT',
            providerPaymentIds: 'PROVIDER_PAYMENT_IDS'
        },
        // billingAddonPurchases.paymentId is read by the webhook refund
        // lifecycle (T-008) to detect addon payments and avoid cancelling
        // a subscription on an addon refund.
        billingAddonPurchases: {
            id: 'ADDON_PURCHASE_ID',
            paymentId: 'PAYMENT_ID_COL'
        },
        and: (...args: unknown[]) => ({ _and: args }),
        eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
        isNull: (a: unknown) => ({ _isNull: a }),
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })
    };
});

vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        SubscriptionStatusEnum: {
            ACTIVE: 'active',
            PENDING_PROVIDER: 'pending_provider',
            ABANDONED: 'abandoned',
            CANCELLED: 'cancelled'
        }
    };
});

vi.mock('../../../src/services/addon-plan-change.service', () => ({
    handlePlanChangeAddonRecalculation: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

// SPEC-194 T-008: mock applyRefundLifecycle so the webhook refund lifecycle
// tests can verify call arguments without running the full service logic.
vi.mock('../../../src/services/refund-lifecycle.service', () => ({
    applyRefundLifecycle: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/services/addon.service', () => {
    const confirmPurchase = vi.fn().mockResolvedValue({ success: true, data: undefined });
    const MockAddonService = vi.fn().mockImplementation(() => ({ confirmPurchase }));
    // Expose confirmPurchase on the constructor for test access
    (MockAddonService as unknown as Record<string, unknown>).__mockConfirmPurchase =
        confirmPurchase;
    return { AddonService: MockAddonService };
});

vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn().mockReturnValue({ name: 'Test Addon', slug: 'test-addon' })
}));

// Allow checkSubscriptionStatusTransition through from the real module, but
// expose it as a spy so individual tests can override it to return invalid.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual };
});

import type { QZPayBilling } from '@qazuor/qzpay-core';
import * as serviceCore from '@repo/service-core';
import { clearEntitlementCache } from '../../../src/middlewares/entitlement';
import {
    sendPaymentFailureNotifications,
    sendPaymentSuccessNotification
} from '../../../src/routes/webhooks/mercadopago/notifications';
import {
    confirmAnnualSubscription,
    processPaymentUpdated
} from '../../../src/routes/webhooks/mercadopago/payment-logic';
import {
    extractAddonFromReference,
    extractAddonMetadata,
    extractAnnualSubscriptionMetadata,
    extractPaymentInfo,
    extractPlanChangeUpgradeMetadata
} from '../../../src/routes/webhooks/mercadopago/utils';
import { AddonService } from '../../../src/services/addon.service';
import { applyRefundLifecycle } from '../../../src/services/refund-lifecycle.service';

/** Helper to get the mocked confirmPurchase fn from the hoisted AddonService mock */
function getMockConfirmPurchase(): ReturnType<typeof vi.fn> {
    return (AddonService as unknown as Record<string, unknown>).__mockConfirmPurchase as ReturnType<
        typeof vi.fn
    >;
}

const mockBilling = {
    customers: {
        get: vi.fn().mockResolvedValue({
            id: 'cust-1',
            email: 'user@test.com',
            metadata: { name: 'Test User', userId: 'usr-1' }
        })
    },
    subscriptions: { getByCustomerId: vi.fn() },
    plans: { list: vi.fn() },
    payments: {
        record: vi.fn().mockResolvedValue({ id: 'recorded-payment-uuid' })
    }
} as unknown as QZPayBilling;

describe('processPaymentUpdated', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAnnualDbState();
        // Re-apply default implementations after clearAllMocks wipes them
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue(null);
        vi.mocked(extractAddonFromReference).mockReturnValue(null);
        vi.mocked(extractAnnualSubscriptionMetadata).mockReturnValue(null);
        vi.mocked(extractPlanChangeUpgradeMetadata).mockReturnValue(null);
        getMockConfirmPurchase().mockResolvedValue({ success: true });
        (mockBilling.customers.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'cust-1',
            email: 'user@test.com',
            metadata: { name: 'Test User', userId: 'usr-1' }
        });
    });

    it('should send success notification for approved payment', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 1000,
            currency: 'ARS',
            status: 'approved',
            statusDetail: null,
            paymentMethod: 'credit_card'
        });

        const result = await processPaymentUpdated({
            data: { metadata: { customerId: 'cust-1' } },
            billing: mockBilling
        });

        expect(sendPaymentSuccessNotification).toHaveBeenCalledWith(
            'cust-1',
            1000,
            'ARS',
            'credit_card',
            mockBilling
        );
        expect(result.success).toBe(true);
    });

    it('should send failure notification for rejected payment', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 500,
            currency: 'ARS',
            status: 'rejected',
            statusDetail: 'cc_rejected_other_reason',
            paymentMethod: 'credit_card'
        });

        const result = await processPaymentUpdated({
            data: { metadata: { customerId: 'cust-1' } },
            billing: mockBilling
        });

        expect(sendPaymentFailureNotifications).toHaveBeenCalledWith(
            'cust-1',
            500,
            'ARS',
            'cc_rejected_other_reason',
            mockBilling
        );
        expect(result.success).toBe(true);
    });

    it('should send failure notification for cancelled payment', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 750,
            currency: 'ARS',
            status: 'cancelled',
            statusDetail: null,
            paymentMethod: 'debit_card'
        });

        const result = await processPaymentUpdated({
            data: { metadata: { customerId: 'cust-1' } },
            billing: mockBilling
        });

        expect(sendPaymentFailureNotifications).toHaveBeenCalledWith(
            'cust-1',
            750,
            'ARS',
            'cancelled',
            mockBilling
        );
        expect(result.success).toBe(true);
    });

    it('should confirm addon purchase when addon metadata present', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue({
            addonSlug: 'premium-photos',
            customerId: 'cust-1'
        });

        const result = await processPaymentUpdated({
            data: { metadata: { addonSlug: 'premium-photos', customerId: 'cust-1' } },
            billing: mockBilling
        });

        expect(result.success).toBe(true);
        expect(result.addonConfirmed).toBe(true);
    });

    it('should return success with no addon when no addon metadata', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue(null);

        const result = await processPaymentUpdated({
            data: {},
            billing: mockBilling
        });

        expect(result.success).toBe(true);
        expect(result.addonConfirmed).toBe(false);
    });

    it('should return failure when addon confirmation fails (generic error)', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue({
            addonSlug: 'premium-photos',
            customerId: 'cust-1'
        });

        getMockConfirmPurchase().mockResolvedValueOnce({
            success: false,
            error: 'Addon not found'
        });

        const result = await processPaymentUpdated({
            data: { metadata: { addonSlug: 'premium-photos', customerId: 'cust-1' } },
            billing: mockBilling
        });

        expect(result.success).toBe(false);
        expect(result.addonConfirmed).toBe(false);
        // Generic failure must NOT set addonAlreadyActive
        expect((result as unknown as Record<string, unknown>).addonAlreadyActive).toBeUndefined();
    });

    // ── T-013: ADDON_ALREADY_ACTIVE → success=true, addonAlreadyActive=true ──
    // When confirmPurchase returns ADDON_ALREADY_ACTIVE, the purchase already
    // exists. processPaymentUpdated must signal this as a semantic success so
    // the polling job can go terminal instead of error-backoff spinning.
    it('ADDON_ALREADY_ACTIVE: returns success=true + addonAlreadyActive=true (SPEC-194 T-013)', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue({
            addonSlug: 'premium-photos',
            customerId: 'cust-1'
        });

        getMockConfirmPurchase().mockResolvedValueOnce({
            success: false,
            error: {
                code: 'ADDON_ALREADY_ACTIVE',
                message: 'Addon already active for this customer'
            }
        });

        const result = await processPaymentUpdated({
            data: { metadata: { addonSlug: 'premium-photos', customerId: 'cust-1' } },
            billing: mockBilling
        });

        // Purchase already exists → this is a semantic success, not a real failure
        expect(result.success).toBe(true);
        expect(result.addonConfirmed).toBe(false);
        expect((result as unknown as Record<string, unknown>).addonAlreadyActive).toBe(true);
    });

    it('should use source label in log messages', async () => {
        const { apiLogger } = await import('../../../src/utils/logger');
        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 1000,
            currency: 'ARS',
            status: 'approved',
            statusDetail: null,
            paymentMethod: 'credit_card'
        });

        await processPaymentUpdated({
            data: { metadata: { customerId: 'cust-1' } },
            billing: mockBilling,
            source: 'dead-letter-retry'
        });

        expect(apiLogger.debug).toHaveBeenCalledWith(
            expect.objectContaining({ source: 'dead-letter-retry' }),
            expect.any(String)
        );
    });

    // -----------------------------------------------------------------------
    // SPEC-141 D1: annual subscription confirmation branch
    // -----------------------------------------------------------------------

    describe('annual subscription confirmation', () => {
        const ANNUAL_SUB_ID = 'annual-sub-uuid-1';
        const MP_PAYMENT_ID = '987654321';

        function approvedAnnualPayment() {
            vi.mocked(extractPaymentInfo).mockReturnValue({
                amount: 350_000,
                currency: 'ARS',
                status: 'approved',
                statusDetail: null,
                paymentMethod: 'credit_card'
            });
            vi.mocked(extractAnnualSubscriptionMetadata).mockReturnValue(ANNUAL_SUB_ID);
        }

        it('flips a pending_provider sub to active and records the payment', async () => {
            approvedAnnualPayment();
            annualDbState.subRows = [
                { id: ANNUAL_SUB_ID, customerId: 'cust-1', status: 'pending_provider' }
            ];
            annualDbState.paymentDedupeRows = []; // not yet recorded

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            expect(result.success).toBe(true);
            expect(result.annualSubscriptionConfirmed).toBe(true);
            expect(result.addonConfirmed).toBe(false);

            // billing.payments.record called with the right shape (centavo amount).
            expect(mockBilling.payments.record).toHaveBeenCalledOnce();
            const recordArg = (mockBilling.payments.record as ReturnType<typeof vi.fn>).mock
                .calls[0]?.[0] as Record<string, unknown>;
            expect(recordArg.customerId).toBe('cust-1');
            expect(recordArg.subscriptionId).toBe(ANNUAL_SUB_ID);
            expect(recordArg.providerPaymentId).toBe(MP_PAYMENT_ID);
            expect(recordArg.amount).toBe(35_000_000); // 350_000 ARS major → centavos
            expect(recordArg.status).toBe('succeeded');

            // Local subscription status flipped to active.
            expect(annualDbState.updateCalls).toHaveLength(1);
            const updateValues = annualDbState.updateCalls[0]?.values as Record<string, unknown>;
            expect(updateValues.status).toBe('active');
        });

        it('idempotent skip when subscription is already active (webhook retry)', async () => {
            approvedAnnualPayment();
            annualDbState.subRows = [{ id: ANNUAL_SUB_ID, customerId: 'cust-1', status: 'active' }];

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            expect(result.annualSubscriptionConfirmed).toBe(false);
            expect(mockBilling.payments.record).not.toHaveBeenCalled();
            expect(annualDbState.updateCalls).toHaveLength(0);
        });

        it('invalidates the entitlement cache for the customer on activation', async () => {
            // Annual checkout activation flips status pending_provider → active,
            // and the entitlement middleware caches per-customer derived plan
            // limits for 5 min. Without clearing on activation the user would
            // see "no plan" features for up to 5 min after paying.
            approvedAnnualPayment();
            annualDbState.subRows = [
                { id: ANNUAL_SUB_ID, customerId: 'cust-1', status: 'pending_provider' }
            ];
            annualDbState.paymentDedupeRows = [];

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            expect(result.annualSubscriptionConfirmed).toBe(true);
            expect(clearEntitlementCache).toHaveBeenCalledOnce();
            expect(clearEntitlementCache).toHaveBeenCalledWith('cust-1');
        });

        it('does NOT invalidate the entitlement cache when activation is skipped (idempotent)', async () => {
            approvedAnnualPayment();
            annualDbState.subRows = [{ id: ANNUAL_SUB_ID, customerId: 'cust-1', status: 'active' }];

            await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            // Sub was already active → no work done → no cache to clear.
            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });

        it('skips record() when the providerPaymentId is already in billing_payments', async () => {
            approvedAnnualPayment();
            annualDbState.subRows = [
                { id: ANNUAL_SUB_ID, customerId: 'cust-1', status: 'pending_provider' }
            ];
            annualDbState.paymentDedupeRows = [{ id: 'existing-billing-payment-uuid' }];

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            // Payment NOT recorded again, but status still flipped to active.
            expect(mockBilling.payments.record).not.toHaveBeenCalled();
            expect(annualDbState.updateCalls).toHaveLength(1);
            expect(result.annualSubscriptionConfirmed).toBe(true);
        });

        it('does NOT activate when MP status is not approved/accredited', async () => {
            vi.mocked(extractPaymentInfo).mockReturnValue({
                amount: 350_000,
                currency: 'ARS',
                status: 'in_process',
                statusDetail: null,
                paymentMethod: 'credit_card'
            });
            vi.mocked(extractAnnualSubscriptionMetadata).mockReturnValue(ANNUAL_SUB_ID);

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            expect(result.annualSubscriptionConfirmed).toBeUndefined();
            expect(mockBilling.payments.record).not.toHaveBeenCalled();
            expect(annualDbState.updateCalls).toHaveLength(0);
        });

        it('logs warn and skips when the local sub is in an unexpected status', async () => {
            approvedAnnualPayment();
            annualDbState.subRows = [
                { id: ANNUAL_SUB_ID, customerId: 'cust-1', status: 'cancelled' }
            ];

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            expect(result.annualSubscriptionConfirmed).toBe(false);
            expect(mockBilling.payments.record).not.toHaveBeenCalled();
            expect(annualDbState.updateCalls).toHaveLength(0);
        });

        it('logs warn and skips when the local sub is not found', async () => {
            approvedAnnualPayment();
            annualDbState.subRows = []; // missing

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            expect(result.annualSubscriptionConfirmed).toBe(false);
            expect(mockBilling.payments.record).not.toHaveBeenCalled();
        });

        it('accepts `accredited` MP status (alongside `approved`)', async () => {
            vi.mocked(extractPaymentInfo).mockReturnValue({
                amount: 350_000,
                currency: 'ARS',
                status: 'accredited',
                statusDetail: null,
                paymentMethod: 'credit_card'
            });
            vi.mocked(extractAnnualSubscriptionMetadata).mockReturnValue(ANNUAL_SUB_ID);
            annualDbState.subRows = [
                { id: ANNUAL_SUB_ID, customerId: 'cust-1', status: 'pending_provider' }
            ];

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID }
                },
                billing: mockBilling
            });

            expect(result.annualSubscriptionConfirmed).toBe(true);
            expect(mockBilling.payments.record).toHaveBeenCalledOnce();
        });

        it('addon and annual branches are mutually exclusive (annual short-circuits dispatch)', async () => {
            approvedAnnualPayment();
            // Even if addon metadata were present, annual dispatch wins.
            vi.mocked(extractAddonMetadata).mockReturnValue({
                addonSlug: 'should-be-ignored',
                customerId: 'cust-1'
            });
            annualDbState.subRows = [
                { id: ANNUAL_SUB_ID, customerId: 'cust-1', status: 'pending_provider' }
            ];

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { annualSubscriptionId: ANNUAL_SUB_ID, addonSlug: 'x' }
                },
                billing: mockBilling
            });

            expect(result.annualSubscriptionConfirmed).toBe(true);
            // Addon path NOT exercised.
            expect(getMockConfirmPurchase()).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-141 D7: plan-change upgrade confirmation branch
    // -----------------------------------------------------------------------

    describe('plan-change upgrade confirmation', () => {
        const UPGRADE_SUB_ID = 'upgrade-sub-uuid';
        const MP_PAYMENT_ID = '555000111';
        const OLD_PLAN_ID = 'plan_basic';
        const NEW_PLAN_ID = 'plan_pro';
        const NEW_PRICE_ID = 'price_pro_monthly';

        function approvedUpgradePayment() {
            vi.mocked(extractPaymentInfo).mockReturnValue({
                amount: 1_000, // major units; delta is ~1k ARS for the upgrade
                currency: 'ARS',
                status: 'approved',
                statusDetail: null,
                paymentMethod: 'credit_card'
            });
            vi.mocked(extractPlanChangeUpgradeMetadata).mockReturnValue({
                planChangeUpgradeId: UPGRADE_SUB_ID,
                oldPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                newPriceId: NEW_PRICE_ID,
                targetTransactionAmountMajor: 2000
            });
        }

        function makeUpgradeBilling(
            opts: {
                sub?: {
                    id: string;
                    customerId: string;
                    planId: string;
                    status: string;
                    providerSubscriptionIds?: Record<string, string>;
                    scheduledPlanChange?: { status: string; targetPlanId?: string } | null;
                } | null;
                paymentAdapterUpdateThrows?: Error;
                paymentAdapterPresent?: boolean;
                changePlanThrows?: Error;
                subscriptionsUpdateThrows?: Error;
            } = {}
        ) {
            const sub =
                opts.sub === undefined
                    ? {
                          id: UPGRADE_SUB_ID,
                          customerId: 'cust-1',
                          planId: OLD_PLAN_ID,
                          status: 'active',
                          providerSubscriptionIds: { mercadopago: 'mp-pre-123' },
                          scheduledPlanChange: null
                      }
                    : opts.sub;

            const changePlan = opts.changePlanThrows
                ? vi.fn().mockRejectedValue(opts.changePlanThrows)
                : vi.fn().mockResolvedValue({
                      subscription: {
                          id: UPGRADE_SUB_ID,
                          customerId: 'cust-1',
                          planId: NEW_PLAN_ID
                      },
                      proration: { chargeAmount: 1000, creditAmount: 0 }
                  });

            const paymentAdapterUpdate = opts.paymentAdapterUpdateThrows
                ? vi.fn().mockRejectedValue(opts.paymentAdapterUpdateThrows)
                : vi.fn().mockResolvedValue({ id: 'mp-pre-123' });

            const paymentAdapter =
                opts.paymentAdapterPresent === false
                    ? null
                    : { subscriptions: { update: paymentAdapterUpdate } };

            const subscriptionsUpdate = opts.subscriptionsUpdateThrows
                ? vi.fn().mockRejectedValue(opts.subscriptionsUpdateThrows)
                : vi.fn().mockResolvedValue({ id: UPGRADE_SUB_ID });

            return {
                customers: mockBilling.customers,
                subscriptions: {
                    get: vi.fn().mockResolvedValue(sub),
                    getByCustomerId: vi.fn(),
                    changePlan,
                    update: subscriptionsUpdate
                },
                plans: { list: vi.fn() },
                payments: {
                    record: vi.fn().mockResolvedValue({ id: 'recorded-delta-uuid' })
                },
                getPaymentAdapter: vi.fn(() => paymentAdapter),
                _paymentAdapterUpdate: paymentAdapterUpdate,
                _subscriptionsUpdate: subscriptionsUpdate
            } as unknown as QZPayBilling & {
                _paymentAdapterUpdate: ReturnType<typeof vi.fn>;
                _subscriptionsUpdate: ReturnType<typeof vi.fn>;
                subscriptions: {
                    get: ReturnType<typeof vi.fn>;
                    changePlan: ReturnType<typeof vi.fn>;
                    update: ReturnType<typeof vi.fn>;
                };
                payments: { record: ReturnType<typeof vi.fn> };
            };
        }

        it('happy path: changePlan, MP propagate, addon recalc, payment record + sub flipped', async () => {
            approvedUpgradePayment();
            annualDbState.subRows = []; // unused for the sub lookup (handled by billing.subscriptions.get)
            annualDbState.paymentDedupeRows = [];
            const billing = makeUpgradeBilling();

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: { planChangeUpgradeId: UPGRADE_SUB_ID, newPlanId: NEW_PLAN_ID }
                },
                billing
            });

            expect(result.success).toBe(true);
            expect(result.planUpgradeConfirmed).toBe(true);
            // Plan change committed
            expect(billing.subscriptions.changePlan).toHaveBeenCalledOnce();
            const changePlanArg = billing.subscriptions.changePlan.mock.calls[0]?.[1] as Record<
                string,
                unknown
            >;
            expect(changePlanArg).toMatchObject({
                newPlanId: NEW_PLAN_ID,
                newPriceId: NEW_PRICE_ID,
                prorationBehavior: 'create_prorations',
                applyAt: 'immediately'
            });
            // MP preapproval updated
            expect(billing._paymentAdapterUpdate).toHaveBeenCalledOnce();
            const mpArgs = billing._paymentAdapterUpdate.mock.calls[0] as [
                string,
                Record<string, unknown>
            ];
            expect(mpArgs[0]).toBe('mp-pre-123');
            expect(mpArgs[1]).toMatchObject({
                planId: NEW_PLAN_ID,
                transactionAmount: 2000
            });
            // Delta payment recorded
            expect(billing.payments.record).toHaveBeenCalledOnce();
            const recordArg = billing.payments.record.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(recordArg.amount).toBe(100_000); // 1000 major → centavos
            expect(recordArg.subscriptionId).toBe(UPGRADE_SUB_ID);
            expect(recordArg.providerPaymentId).toBe(MP_PAYMENT_ID);
        });

        it('idempotent skip when sub.planId already equals newPlanId', async () => {
            approvedUpgradePayment();
            const billing = makeUpgradeBilling({
                sub: {
                    id: UPGRADE_SUB_ID,
                    customerId: 'cust-1',
                    planId: NEW_PLAN_ID, // already upgraded
                    status: 'active',
                    providerSubscriptionIds: { mercadopago: 'mp-pre-123' }
                }
            });

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBe(false);
            expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
            expect(billing.payments.record).not.toHaveBeenCalled();
        });

        it('skips when sub is not active/trialing', async () => {
            approvedUpgradePayment();
            const billing = makeUpgradeBilling({
                sub: {
                    id: UPGRADE_SUB_ID,
                    customerId: 'cust-1',
                    planId: OLD_PLAN_ID,
                    status: 'canceled',
                    providerSubscriptionIds: {}
                }
            });

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBe(false);
            expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
        });

        it('skips when sub is not found', async () => {
            approvedUpgradePayment();
            const billing = makeUpgradeBilling({ sub: null });

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBe(false);
        });

        it('does not commit when MP status is not approved/accredited', async () => {
            vi.mocked(extractPaymentInfo).mockReturnValue({
                amount: 1_000,
                currency: 'ARS',
                status: 'in_process',
                statusDetail: null,
                paymentMethod: 'credit_card'
            });
            vi.mocked(extractPlanChangeUpgradeMetadata).mockReturnValue({
                planChangeUpgradeId: UPGRADE_SUB_ID,
                oldPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                newPriceId: NEW_PRICE_ID,
                targetTransactionAmountMajor: 2000
            });
            const billing = makeUpgradeBilling();

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBeUndefined();
            expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
        });

        it('continues with status flip even when MP propagation throws (best-effort)', async () => {
            approvedUpgradePayment();
            const billing = makeUpgradeBilling({
                paymentAdapterUpdateThrows: new Error('MP timeout')
            });

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBe(true);
            expect(billing.subscriptions.changePlan).toHaveBeenCalledOnce();
            // Payment still recorded (MP failure is non-blocking).
            expect(billing.payments.record).toHaveBeenCalledOnce();
        });

        it('skips MP propagation when sub has no MP provider id (no error)', async () => {
            approvedUpgradePayment();
            const billing = makeUpgradeBilling({
                sub: {
                    id: UPGRADE_SUB_ID,
                    customerId: 'cust-1',
                    planId: OLD_PLAN_ID,
                    status: 'active',
                    providerSubscriptionIds: {} // no mercadopago key
                }
            });

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBe(true);
            expect(billing._paymentAdapterUpdate).not.toHaveBeenCalled();
        });

        it('does not double-record when delta payment was already in billing_payments', async () => {
            approvedUpgradePayment();
            // Upgrade flow only does ONE getDb().select() (the payment
            // dedupe — sub lookup goes through billing.subscriptions.get).
            // So that first select hits `subRows` in our mock.
            annualDbState.subRows = [
                { id: 'pre-existing-payment-row', customerId: '', status: '' }
            ];
            annualDbState.paymentDedupeRows = [];
            const billing = makeUpgradeBilling();

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBe(true);
            expect(billing.subscriptions.changePlan).toHaveBeenCalledOnce();
            expect(billing.payments.record).not.toHaveBeenCalled();
        });

        // ── SPEC-141 Fase 4 C4: race-condition cleanup ───────────────────
        // When an upgrade lands, any pending scheduled downgrade queued
        // on the same sub is obsolete and must be cleared.

        it('upgrade success clears any pending scheduled downgrade', async () => {
            approvedUpgradePayment();
            const billing = makeUpgradeBilling({
                sub: {
                    id: UPGRADE_SUB_ID,
                    customerId: 'cust-1',
                    planId: OLD_PLAN_ID,
                    status: 'active',
                    providerSubscriptionIds: { mercadopago: 'mp-pre-123' },
                    scheduledPlanChange: { status: 'pending', targetPlanId: 'plan_starter' }
                }
            });

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBe(true);
            expect(billing._subscriptionsUpdate).toHaveBeenCalledOnce();
            const updateArgs = billing._subscriptionsUpdate.mock.calls[0] as [
                string,
                Record<string, unknown>
            ];
            expect(updateArgs[0]).toBe(UPGRADE_SUB_ID);
            expect(updateArgs[1]).toEqual({ scheduledPlanChange: null });
        });

        it('upgrade success does not call update when no pending schedule exists', async () => {
            approvedUpgradePayment();
            // Default sub from makeUpgradeBilling has scheduledPlanChange: null.
            const billing = makeUpgradeBilling();

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            expect(result.planUpgradeConfirmed).toBe(true);
            // clearPendingScheduledPlanChange short-circuits when
            // scheduledPlanChange is null — no update should happen.
            expect(billing._subscriptionsUpdate).not.toHaveBeenCalled();
        });

        it('clear failure does not break upgrade confirmation (best-effort)', async () => {
            approvedUpgradePayment();
            const billing = makeUpgradeBilling({
                sub: {
                    id: UPGRADE_SUB_ID,
                    customerId: 'cust-1',
                    planId: OLD_PLAN_ID,
                    status: 'active',
                    providerSubscriptionIds: { mercadopago: 'mp-pre-123' },
                    scheduledPlanChange: { status: 'pending', targetPlanId: 'plan_starter' }
                },
                subscriptionsUpdateThrows: new Error('qzpay update timeout')
            });

            const result = await processPaymentUpdated({
                data: { id: MP_PAYMENT_ID, metadata: { planChangeUpgradeId: UPGRADE_SUB_ID } },
                billing
            });

            // Upgrade still confirmed despite the clear failure.
            expect(result.planUpgradeConfirmed).toBe(true);
            expect(billing.subscriptions.changePlan).toHaveBeenCalledOnce();
            expect(billing._subscriptionsUpdate).toHaveBeenCalledOnce();
        });

        it('annual takes precedence when both metadata keys are (erroneously) present', async () => {
            // Both annual and upgrade metadata set → annual short-circuits first.
            vi.mocked(extractAnnualSubscriptionMetadata).mockReturnValue('annual-sub-id');
            vi.mocked(extractPlanChangeUpgradeMetadata).mockReturnValue({
                planChangeUpgradeId: UPGRADE_SUB_ID,
                oldPlanId: OLD_PLAN_ID,
                newPlanId: NEW_PLAN_ID,
                newPriceId: NEW_PRICE_ID,
                targetTransactionAmountMajor: 2000
            });
            vi.mocked(extractPaymentInfo).mockReturnValue({
                amount: 1000,
                currency: 'ARS',
                status: 'approved',
                statusDetail: null,
                paymentMethod: 'credit_card'
            });
            annualDbState.subRows = [
                { id: 'annual-sub-id', customerId: 'cust-1', status: 'pending_provider' }
            ];
            const billing = makeUpgradeBilling();

            const result = await processPaymentUpdated({
                data: {
                    id: MP_PAYMENT_ID,
                    metadata: {
                        annualSubscriptionId: 'annual-sub-id',
                        planChangeUpgradeId: UPGRADE_SUB_ID
                    }
                },
                billing
            });

            // Annual confirm path fired; upgrade did NOT.
            expect(result.annualSubscriptionConfirmed).toBe(true);
            expect(result.planUpgradeConfirmed).toBeUndefined();
            expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-127: addon external_reference fallback warn branch
    // Tests the no-metadata diagnostic path for both legacy and qzpay-era payments.
    // -----------------------------------------------------------------------

    describe('addon external_reference fallback warn branch (SPEC-127)', () => {
        it('legacy addon_SLUG_TIMESTAMP reference without metadata fires legacy warn', async () => {
            const { apiLogger } = await import('../../../src/utils/logger');
            vi.mocked(extractAddonMetadata).mockReturnValue(null);
            vi.mocked(extractAddonFromReference).mockReturnValue('visibility-boost-7d');

            const result = await processPaymentUpdated({
                data: {
                    id: 'mp-legacy-1',
                    external_reference: 'addon_visibility-boost-7d_1700000000000',
                    status: 'approved',
                    metadata: null
                },
                billing: mockBilling
            });

            expect(result.success).toBe(true);
            expect(result.addonConfirmed).toBe(false);
            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    addonSlug: 'visibility-boost-7d'
                }),
                'Found add-on slug in external_reference but missing customerId - addon purchase may not be confirmed properly'
            );
        });

        it('bare UUID external_reference without addon metadata fires qzpay-era warn', async () => {
            const { apiLogger } = await import('../../../src/utils/logger');
            vi.mocked(extractAddonMetadata).mockReturnValue(null);
            vi.mocked(extractAddonFromReference).mockReturnValue(null);

            const qzpaySessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            const result = await processPaymentUpdated({
                data: {
                    id: 'mp-qzpay-1',
                    external_reference: qzpaySessionId,
                    status: 'approved',
                    metadata: {}
                },
                billing: mockBilling
            });

            expect(result.success).toBe(true);
            expect(result.addonConfirmed).toBe(false);
            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    externalReference: qzpaySessionId,
                    paymentId: 'mp-qzpay-1',
                    paymentStatus: 'approved',
                    metadataKeys: []
                }),
                'Payment has bare UUID external_reference (qzpay session id) but no addon metadata - possible qzpay-era addon payment missing metadata; correlate via qzpay checkout session'
            );
        });

        it('payment WITH addon metadata goes through normal confirm path without any fallback warn', async () => {
            const { apiLogger } = await import('../../../src/utils/logger');
            vi.mocked(extractAddonMetadata).mockReturnValue({
                addonSlug: 'visibility-boost-7d',
                customerId: 'cust-1'
            });
            vi.mocked(extractAddonFromReference).mockReturnValue(null);

            const result = await processPaymentUpdated({
                data: {
                    id: 'mp-with-meta-1',
                    external_reference: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    metadata: { addonSlug: 'visibility-boost-7d', customerId: 'cust-1' }
                },
                billing: mockBilling
            });

            expect(result.success).toBe(true);
            expect(result.addonConfirmed).toBe(true);
            // No fallback warn emitted
            const warnCalls = (apiLogger.warn as ReturnType<typeof vi.fn>).mock
                .calls as unknown[][];
            const fallbackWarns = warnCalls.filter((args) => {
                const msg = args[1];
                return (
                    msg ===
                        'Found add-on slug in external_reference but missing customerId - addon purchase may not be confirmed properly' ||
                    (typeof msg === 'string' && msg.includes('qzpay session id'))
                );
            });
            expect(fallbackWarns).toHaveLength(0);
        });
    });
});

// ─── SPEC-194 T-008: webhook refund lifecycle wiring ─────────────────────────
//
// When MP fires a `payment.updated` event with status `refunded`, the webhook
// path MUST call `applyRefundLifecycle` so the linked subscription is
// cancelled (or the call is a no-op when the payment has no subscription).
//
// Mock strategy:
//   - `applyRefundLifecycle` is mocked at module level (see vi.mock near the
//     top of the file, alongside the other service mocks).
//   - The new DB selects inside `processPaymentUpdated` reuse the existing
//     `annualDbState.subRows` (select index 0 within a `getDb()` scope =
//     the local payment lookup) and `annualDbState.paymentDedupeRows` (select
//     index 1 = the addon purchase check), which are reset in `beforeEach`.
describe('processPaymentUpdated — webhook refund lifecycle (SPEC-194 T-008)', () => {
    const MP_PAYMENT_ID = 'mp-refund-pay-9001';
    const LOCAL_PAYMENT_ID = 'local-pay-uuid-001';
    const CUSTOMER_ID = 'cust-refund-99';
    const SUBSCRIPTION_ID = 'sub-refund-abc';
    const PAYMENT_AMOUNT_CENTAVOS = 150_000; // 1500 ARS in centavos

    function refundedPaymentData(
        overrides: Partial<Record<string, unknown>> = {}
    ): Record<string, unknown> {
        return {
            id: MP_PAYMENT_ID,
            metadata: { customerId: CUSTOMER_ID },
            ...overrides
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        resetAnnualDbState();
        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 1500,
            currency: 'ARS',
            status: 'refunded',
            statusDetail: null,
            paymentMethod: 'credit_card'
        });
        vi.mocked(extractAddonMetadata).mockReturnValue(null);
        vi.mocked(extractAddonFromReference).mockReturnValue(null);
        vi.mocked(extractAnnualSubscriptionMetadata).mockReturnValue(null);
        vi.mocked(extractPlanChangeUpgradeMetadata).mockReturnValue(null);
        getMockConfirmPurchase().mockResolvedValue({ success: true });
        vi.mocked(applyRefundLifecycle).mockResolvedValue(undefined);
    });

    it('calls applyRefundLifecycle with the resolved payment when status=refunded', async () => {
        // Arrange: first select (index 0) returns the local payment row;
        // second select (index 1) returns no addon purchase row.
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = []; // no addon purchase

        const result = await processPaymentUpdated({
            data: refundedPaymentData(),
            billing: mockBilling,
            source: 'webhook'
        });

        expect(result.success).toBe(true);
        expect(applyRefundLifecycle).toHaveBeenCalledOnce();
        expect(applyRefundLifecycle).toHaveBeenCalledWith({
            payment: expect.objectContaining({
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }),
            refundAmount: undefined, // no transaction_amount_refunded in data
            adminUserId: 'webhook',
            source: 'webhook'
        });
    });

    it('skips applyRefundLifecycle when no local payment row is found for the MP payment id', async () => {
        // Arrange: payment lookup returns nothing
        annualDbState.subRows = [];
        annualDbState.paymentDedupeRows = [];

        const { apiLogger } = await import('../../../src/utils/logger');

        const result = await processPaymentUpdated({
            data: refundedPaymentData(),
            billing: mockBilling,
            source: 'webhook'
        });

        expect(result.success).toBe(true);
        expect(applyRefundLifecycle).not.toHaveBeenCalled();
        expect(apiLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ mpPaymentId: MP_PAYMENT_ID }),
            expect.stringContaining('local payment not found')
        );
    });

    it('skips refund lifecycle when data.id is missing (no MP payment id)', async () => {
        // data.id absent: cannot resolve the local payment
        annualDbState.subRows = [];
        annualDbState.paymentDedupeRows = [];

        const result = await processPaymentUpdated({
            data: { metadata: { customerId: CUSTOMER_ID } }, // no id
            billing: mockBilling,
            source: 'webhook'
        });

        expect(result.success).toBe(true);
        expect(applyRefundLifecycle).not.toHaveBeenCalled();
    });

    it('guards addon payment: warns and does NOT call applyRefundLifecycle', async () => {
        // Arrange: payment has no subscriptionId (addon payment),
        // and the addon purchase check finds a matching row.
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: null,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = [{ id: 'addon-purchase-uuid' }]; // addon purchase found

        const { apiLogger } = await import('../../../src/utils/logger');

        const result = await processPaymentUpdated({
            data: refundedPaymentData(),
            billing: mockBilling,
            source: 'webhook'
        });

        expect(result.success).toBe(true);
        expect(applyRefundLifecycle).not.toHaveBeenCalled();
        expect(apiLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ mpPaymentId: MP_PAYMENT_ID }),
            expect.stringContaining('addon payment')
        );
    });

    it('still calls applyRefundLifecycle when payment has no subscriptionId but is NOT an addon payment', async () => {
        // Payment has subscriptionId=null AND no addon purchase found.
        // applyRefundLifecycle is still called; it will no-op internally
        // (its own guard handles payments with no subscriptionId).
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: null,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = []; // no addon purchase

        await processPaymentUpdated({
            data: refundedPaymentData(),
            billing: mockBilling,
            source: 'webhook'
        });

        // applyRefundLifecycle IS called (its no-sub guard handles the rest).
        expect(applyRefundLifecycle).toHaveBeenCalledOnce();
        expect(applyRefundLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({ payment: expect.objectContaining({ subscriptionId: null }) })
        );
    });

    it('does NOT call applyRefundLifecycle for a cancelled (non-refunded) payment', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 1500,
            currency: 'ARS',
            status: 'cancelled',
            statusDetail: null,
            paymentMethod: 'credit_card'
        });

        const result = await processPaymentUpdated({
            data: refundedPaymentData(),
            billing: mockBilling,
            source: 'webhook'
        });

        expect(result.success).toBe(true);
        expect(applyRefundLifecycle).not.toHaveBeenCalled();
    });

    it('does NOT call applyRefundLifecycle for a rejected payment', async () => {
        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 1500,
            currency: 'ARS',
            status: 'rejected',
            statusDetail: 'cc_rejected_other_reason',
            paymentMethod: 'credit_card'
        });

        const result = await processPaymentUpdated({
            data: refundedPaymentData(),
            billing: mockBilling,
            source: 'webhook'
        });

        expect(result.success).toBe(true);
        expect(applyRefundLifecycle).not.toHaveBeenCalled();
    });

    it('does not crash when applyRefundLifecycle throws (fail-safe)', async () => {
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = [];
        vi.mocked(applyRefundLifecycle).mockRejectedValue(new Error('db offline'));

        const { apiLogger } = await import('../../../src/utils/logger');

        await expect(
            processPaymentUpdated({
                data: refundedPaymentData(),
                billing: mockBilling,
                source: 'webhook'
            })
        ).resolves.toMatchObject({ success: true });

        expect(apiLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ mpPaymentId: MP_PAYMENT_ID }),
            expect.stringContaining('applyRefundLifecycle')
        );
    });

    it('still sends failure notification alongside the refund lifecycle call', async () => {
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = [];

        await processPaymentUpdated({
            data: refundedPaymentData(),
            billing: mockBilling,
            source: 'webhook'
        });

        expect(sendPaymentFailureNotifications).toHaveBeenCalledWith(
            CUSTOMER_ID,
            1500,
            'ARS',
            'refunded',
            mockBilling
        );
        expect(applyRefundLifecycle).toHaveBeenCalledOnce();
    });

    // ── T-019: transaction_amount_refunded partial detection ──────────────
    // When the MP payload carries transaction_amount_refunded, it is converted
    // from major units (ARS pesos) to centavos and passed as refundAmount.

    it('T-019: passes refundAmount in centavos when transaction_amount_refunded is present', async () => {
        // MP sends 150.00 ARS (major units) → 15000 centavos
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = [];

        await processPaymentUpdated({
            data: {
                ...refundedPaymentData(),
                transaction_amount_refunded: 150.0 // major units
            },
            billing: mockBilling,
            source: 'webhook'
        });

        expect(applyRefundLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                refundAmount: 15000, // 150.00 * 100 = 15000 centavos
                source: 'webhook'
            })
        );
    });

    it('T-019: passes refundAmount=undefined when transaction_amount_refunded is absent', async () => {
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = [];

        await processPaymentUpdated({
            data: refundedPaymentData(), // no transaction_amount_refunded
            billing: mockBilling,
            source: 'webhook'
        });

        expect(applyRefundLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                refundAmount: undefined
            })
        );
    });

    it('T-019: passes refundAmount=undefined when transaction_amount_refunded is non-numeric', async () => {
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = [];

        await processPaymentUpdated({
            data: {
                ...refundedPaymentData(),
                transaction_amount_refunded: 'bad-value' // non-numeric
            },
            billing: mockBilling,
            source: 'webhook'
        });

        expect(applyRefundLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                refundAmount: undefined
            })
        );
    });

    it('T-019: rounds fractional centavo amounts correctly (Math.round)', async () => {
        // MP sends 150.005 ARS → Math.round(150.005 * 100) = 15001 (not 15000 or 15000.5)
        annualDbState.subRows = [
            {
                id: LOCAL_PAYMENT_ID,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                amount: PAYMENT_AMOUNT_CENTAVOS
            }
        ];
        annualDbState.paymentDedupeRows = [];

        await processPaymentUpdated({
            data: {
                ...refundedPaymentData(),
                transaction_amount_refunded: 150.005
            },
            billing: mockBilling,
            source: 'webhook'
        });

        expect(applyRefundLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                refundAmount: Math.round(150.005 * 100) // 15001
            })
        );
    });
});

// ─── Transition guard tests (SPEC-194 T-002) ──────────────────────────────────
// These tests exercise the checkSubscriptionStatusTransition guard added to
// confirmAnnualSubscription directly (not through processPaymentUpdated) so
// we can focus on the guard logic without the extra layer of event dispatch.

describe('confirmAnnualSubscription — transition guard', () => {
    const ANNUAL_SUB_ID = 'annual-guard-test-uuid';
    const MP_PAYMENT_ID = '111222333';

    const mockBillingForGuard = {
        customers: { get: vi.fn() },
        subscriptions: { getByCustomerId: vi.fn() },
        plans: { list: vi.fn() },
        payments: { record: vi.fn().mockResolvedValue({ id: 'pmt-uuid' }) },
        getStorage: vi.fn().mockReturnValue({ subscriptionPollingJobs: null })
    } as unknown as QZPayBilling;

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: real checkSubscriptionStatusTransition (valid for pending_provider→active).
        // Re-set the db mock state.
        resetAnnualDbState();
        // Re-apply db mock defaults after clearAllMocks wipes them.
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue(null);
        vi.mocked(extractAddonFromReference).mockReturnValue(null);
        vi.mocked(extractAnnualSubscriptionMetadata).mockReturnValue(null);
        vi.mocked(extractPlanChangeUpgradeMetadata).mockReturnValue(null);
        (mockBillingForGuard.payments.record as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'pmt-uuid'
        });
        vi.mocked(mockBillingForGuard.getStorage).mockReturnValue({
            subscriptionPollingJobs: null
        } as never);
    });

    it('legal transition (pending_provider → active): writes the status', async () => {
        // Arrange
        annualDbState.subRows = [
            { id: ANNUAL_SUB_ID, customerId: 'cust-guard', status: 'pending_provider' }
        ];
        annualDbState.paymentDedupeRows = [];

        // Act
        const result = await confirmAnnualSubscription({
            annualSubscriptionId: ANNUAL_SUB_ID,
            providerPaymentId: MP_PAYMENT_ID,
            amount: 100,
            currency: 'ARS',
            billing: mockBillingForGuard,
            source: 'test'
        });

        // Assert: confirmed and status flipped
        expect(result.confirmed).toBe(true);
        expect(annualDbState.updateCalls).toHaveLength(1);
        const updateVals = annualDbState.updateCalls[0]?.values as Record<string, unknown>;
        expect(updateVals.status).toBe('active');
    });

    it('guard returns invalid (spy): logs error and skips status write (defense-in-depth)', async () => {
        const { apiLogger } = await import('../../../src/utils/logger');
        // The existing early-exit at `status !== pending_provider` (lines ~121-132)
        // already handles most illegal cases. This test verifies the guard catches
        // any illegal case that *reaches* it (e.g. after future refactoring).
        // We use a spy to force the guard to return invalid for a pending_provider sub,
        // simulating a future state where the transition table is tightened.
        const guardSpy = vi
            .spyOn(serviceCore, 'checkSubscriptionStatusTransition')
            .mockReturnValue({
                valid: false,
                reason: 'Transition pending_provider → active is not permitted (test override)'
            });

        annualDbState.subRows = [
            { id: ANNUAL_SUB_ID, customerId: 'cust-guard', status: 'pending_provider' }
        ];
        annualDbState.paymentDedupeRows = [];

        // Act
        const result = await confirmAnnualSubscription({
            annualSubscriptionId: ANNUAL_SUB_ID,
            providerPaymentId: MP_PAYMENT_ID,
            amount: 100,
            currency: 'ARS',
            billing: mockBillingForGuard,
            source: 'test'
        });

        // Assert: not confirmed, no DB write, error logged
        expect(result.confirmed).toBe(false);
        expect(annualDbState.updateCalls).toHaveLength(0);
        expect(apiLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: ANNUAL_SUB_ID,
                from: 'pending_provider',
                to: 'active'
            }),
            expect.stringContaining('invalid status transition')
        );

        guardSpy.mockRestore();
    });
});
