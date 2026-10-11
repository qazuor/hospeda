import { describe, expect, it } from 'vitest';
import { deliveryChannelFromUrl } from '../../../../src/services/billing/notice/provider-delivery-channel.js';

describe('deliveryChannelFromUrl', () => {
    it('recognizes the exact Webhooks marker and ignores other casing or values', () => {
        expect(deliveryChannelFromUrl({ url: 'https://x.test/a?source_news=webhooks' })).toBe(
            'WEBHOOKS'
        );
        expect(deliveryChannelFromUrl({ url: 'https://x.test/a' })).toBe('IPN');
        expect(deliveryChannelFromUrl({ url: 'https://x.test/a?source_news=ipn' })).toBe('IPN');
        expect(deliveryChannelFromUrl({ url: 'https://x.test/a?SOURCE_NEWS=webhooks' })).toBe(
            'IPN'
        );
    });

    it('supports relative and unreadable URLs and finds the marker among other parameters', () => {
        expect(deliveryChannelFromUrl({ url: '/a?source_news=webhooks' })).toBe('WEBHOOKS');
        expect(deliveryChannelFromUrl({ url: '/a?topic=payment' })).toBe('IPN');
        expect(deliveryChannelFromUrl({ url: 'http://[' })).toBe('IPN');
        expect(
            deliveryChannelFromUrl({ url: '?data.id=1&source_news=webhooks&type=payment' })
        ).toBe('WEBHOOKS');
    });
});
