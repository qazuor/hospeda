import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://site.test',
        HOSPEDA_API_URL: 'https://api.test'
    }
}));

import {
    buildAnnualCancelUrl,
    buildAnnualSuccessUrl,
    buildNotificationUrl,
    buildPaymentMethodReturnUrl
} from '../../../src/routes/billing/checkout-return-urls.js';

describe('checkout-return-urls — annual builders (HOS-123 T-005)', () => {
    it('buildAnnualSuccessUrl returns the locale-prefixed checkout success page', () => {
        expect(buildAnnualSuccessUrl('es')).toBe(
            'https://site.test/es/suscriptores/checkout/success/'
        );
        expect(buildAnnualSuccessUrl('en')).toBe(
            'https://site.test/en/suscriptores/checkout/success/'
        );
        expect(buildAnnualSuccessUrl('pt')).toBe(
            'https://site.test/pt/suscriptores/checkout/success/'
        );
    });

    it('buildAnnualCancelUrl returns the locale-prefixed checkout failure page', () => {
        expect(buildAnnualCancelUrl('es')).toBe(
            'https://site.test/es/suscriptores/checkout/failure/'
        );
        expect(buildAnnualCancelUrl('en')).toBe(
            'https://site.test/en/suscriptores/checkout/failure/'
        );
        expect(buildAnnualCancelUrl('pt')).toBe(
            'https://site.test/pt/suscriptores/checkout/failure/'
        );
    });

    it('annual success URL matches the monthly return URL (same success page)', () => {
        // Documents the intentional parity: both land on the success page so a
        // paid reactivation and a first-time checkout never diverge.
        expect(buildAnnualSuccessUrl('es')).toBe(buildPaymentMethodReturnUrl('es'));
    });

    it('buildNotificationUrl points at the MP webhook endpoint with the v2 source_news marker (HOS-159)', () => {
        const url = buildNotificationUrl();
        expect(url).toBe('https://api.test/api/v1/webhooks/mercadopago?source_news=webhooks');
        // HOS-159 regression guard: the `?source_news=webhooks` marker MUST be
        // present. The webhook router (routes/webhooks/mercadopago/router.ts,
        // V2_SOURCE_NEWS_MARKER) DROPS any delivery without it as a legacy IPN
        // duplicate — without this marker every subscription webhook MP posts to
        // this notification_url is silently discarded (0 billing_webhook_events /
        // billing_payments; activation falls back to the polling cron only).
        expect(url).toContain('source_news=webhooks');
    });
});
