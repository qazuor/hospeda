import { describe, expect, it } from 'vitest';
import { resolveAddonRefundChannel } from '../../../../src/services/billing/refund/refund-addon-channel.js';

describe('HOS-2179 §5.11 add-on refund channel', () => {
    it('refunds an instance bought on a payment page as a plain payment', () => {
        // Arrange
        const instance = { providerOrderId: null, paymentPageId: 'page-1' };

        // Act
        const { channel } = resolveAddonRefundChannel(instance);

        // Assert
        expect(channel).toBe('PAYMENT');
    });

    it('sends nothing for an instance bought through the retired order path (T-7)', () => {
        // Arrange
        const instance = { providerOrderId: 'order-1', paymentPageId: null };

        // Act
        const { channel } = resolveAddonRefundChannel(instance);

        // Assert
        expect(channel).toBe('NONE');
    });

    it('sends nothing for an instance with neither an order nor a page', () => {
        // Arrange
        const instance = { providerOrderId: null, paymentPageId: null };

        // Act
        const { channel } = resolveAddonRefundChannel(instance);

        // Assert
        expect(channel).toBe('NONE');
    });

    it('sends nothing for an instance that claims both an order and a page', () => {
        // Arrange
        const instance = { providerOrderId: 'order-1', paymentPageId: 'page-1' };

        // Act
        const { channel } = resolveAddonRefundChannel(instance);

        // Assert
        expect(channel).toBe('NONE');
    });
});
