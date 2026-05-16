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
    extractAnnualSubscriptionMetadata: vi.fn().mockReturnValue(null)
}));

// `@repo/db` mocked at module level so the annual confirmation flow's
// direct Drizzle reads/updates (status flip, payment dedupe) do not need
// a live Postgres. Each test overrides the per-call rows via the queue
// helpers below.
const annualDbState: {
    subRows: Array<{ id: string; customerId: string; status: string }>;
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
        and: (...args: unknown[]) => ({ _and: args }),
        eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
        isNull: (a: unknown) => ({ _isNull: a }),
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })
    };
});

vi.mock('@repo/schemas', () => ({
    SubscriptionStatusEnum: {
        ACTIVE: 'active',
        PENDING_PROVIDER: 'pending_provider',
        ABANDONED: 'abandoned',
        CANCELLED: 'cancelled'
    }
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

import type { QZPayBilling } from '@qazuor/qzpay-core';
import {
    sendPaymentFailureNotifications,
    sendPaymentSuccessNotification
} from '../../../src/routes/webhooks/mercadopago/notifications';
import { processPaymentUpdated } from '../../../src/routes/webhooks/mercadopago/payment-logic';
import {
    extractAddonFromReference,
    extractAddonMetadata,
    extractAnnualSubscriptionMetadata,
    extractPaymentInfo
} from '../../../src/routes/webhooks/mercadopago/utils';
import { AddonService } from '../../../src/services/addon.service';

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

    it('should return failure when addon confirmation fails', async () => {
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
});
