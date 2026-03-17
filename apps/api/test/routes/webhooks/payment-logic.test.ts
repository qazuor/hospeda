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
    extractAddonFromReference: vi.fn().mockReturnValue(null)
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
    plans: { list: vi.fn() }
} as unknown as QZPayBilling;

describe('processPaymentUpdated', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-apply default implementations after clearAllMocks wipes them
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue(null);
        vi.mocked(extractAddonFromReference).mockReturnValue(null);
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
});
