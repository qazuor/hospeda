import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://site.test',
        HOSPEDA_API_URL: 'https://api.test'
    }
}));

import {
    buildAddonCancelUrl,
    buildAddonSuccessUrl,
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

    it('buildAddonSuccessUrl returns the locale-prefixed, trailing-slashed add-ons page (HOS-224)', () => {
        // HOS-224 regression: the old checkout hard-coded
        // `${webUrl}/mi-cuenta/addons?status=...` — no locale prefix, no
        // trailing slash, and a page that did not exist — so a returning payer
        // hit Astro's `/es/` 404 rewrite. The builder MUST carry `/{locale}`
        // and a trailing slash BEFORE the query string.
        expect(buildAddonSuccessUrl('es', 'visibility-boost-7d')).toBe(
            'https://site.test/es/mi-cuenta/addons/?status=success&addon=visibility-boost-7d'
        );
        expect(buildAddonSuccessUrl('en', 'extra-photos-20')).toBe(
            'https://site.test/en/mi-cuenta/addons/?status=success&addon=extra-photos-20'
        );
        expect(buildAddonSuccessUrl('pt', 'extra-accommodations-5')).toBe(
            'https://site.test/pt/mi-cuenta/addons/?status=success&addon=extra-accommodations-5'
        );
    });

    it('buildAddonCancelUrl returns the locale-prefixed add-ons page with status=failure (HOS-224)', () => {
        expect(buildAddonCancelUrl('es', 'visibility-boost-30d')).toBe(
            'https://site.test/es/mi-cuenta/addons/?status=failure&addon=visibility-boost-30d'
        );
        expect(buildAddonCancelUrl('en', 'extra-photos-20')).toBe(
            'https://site.test/en/mi-cuenta/addons/?status=failure&addon=extra-photos-20'
        );
    });

    it('add-on return URLs keep the trailing slash before the query string (Finding #8 guard)', () => {
        // The `/addons/?` shape (slash then `?`) is what keeps Astro's locale
        // middleware from rewriting the path into a 404 — assert it explicitly.
        expect(buildAddonSuccessUrl('es', 'x')).toContain('/mi-cuenta/addons/?');
        expect(buildAddonCancelUrl('es', 'x')).toContain('/mi-cuenta/addons/?');
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
