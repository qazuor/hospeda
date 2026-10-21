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

    it('recognizes measured Webhooks query shapes, including the issue URL', () => {
        expect(
            deliveryChannelFromUrl({
                url: '/api/v1/webhooks/mercadopago?data.id=5b28d196a6ec457790e5f0114c4a4992&type=subscription_preapproval'
            })
        ).toBe('WEBHOOKS');
        for (const type of ['payment', 'subscription_authorized_payment']) {
            expect(deliveryChannelFromUrl({ url: `?data.id=1&type=${type}` })).toBe('WEBHOOKS');
        }
        expect(deliveryChannelFromUrl({ url: '?type=payment&data.id=1' })).toBe('WEBHOOKS');
    });

    it('keeps IPN and incomplete Webhooks query shapes as IPN', () => {
        for (const url of [
            '?id=184258317979&topic=payment',
            '?topic=merchant_order&id=1',
            '?data.id=1',
            '?type=payment',
            '?data.id=&type=payment',
            '?data.id=1&type=',
            '/a',
            '?source_news=webhooks&t=x'
        ]) {
            expect(deliveryChannelFromUrl({ url })).toBe(
                url === '?source_news=webhooks&t=x' ? 'WEBHOOKS' : 'IPN'
            );
        }
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
