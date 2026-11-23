import { describe, expect, it } from 'vitest';
import {
    buildEmailTemplateCampaign,
    buildEmailTemplatePixelSlug,
    buildNewsletterCampaignSlug,
    buildNewsletterPixelSlug,
    toUtmToken
} from '../src/index.js';

describe('toUtmToken', () => {
    it.each([
        ['auth.reset-password', 'auth-reset-password'],
        ['notification.payment_success', 'notification-payment-success'],
        [
            'outbox.verticals.listing-business-lines-changed',
            'outbox-verticals-listing-business-lines-changed'
        ],
        ['  Otoño en el Litoral!! ', 'otono-en-el-litoral'],
        ['--A__B--', 'a-b'],
        ['', '']
    ])('%s -> %s', (input, expected) => {
        expect(toUtmToken(input)).toBe(expected);
    });
});

describe('email template slugs', () => {
    it('derives campaign and pixel slug from the catalog key', () => {
        expect(buildEmailTemplateCampaign({ key: 'auth.reset-password' })).toBe(
            'auth-reset-password'
        );
        expect(buildEmailTemplatePixelSlug({ key: 'auth.reset-password' })).toBe(
            'email-auth-reset-password'
        );
    });

    it('keeps two send paths with the same id apart', () => {
        expect(buildEmailTemplatePixelSlug({ key: 'conversation.verify' })).not.toBe(
            buildEmailTemplatePixelSlug({ key: 'newsletter.verify' })
        );
    });
});

describe('newsletter slugs', () => {
    const id = '0f3a9c2e-1b4d-4e5f-8a9b-1234567890ab';

    it('joins the kebab title and the first 8 hex chars of the id', () => {
        expect(buildNewsletterCampaignSlug({ title: 'Novedades de Otoño', id })).toBe(
            'novedades-de-otono-0f3a9c2e'
        );
    });

    it('cuts the title at 40 chars without a trailing dash', () => {
        // 'a'*39 + ' b...' would cut at a dash at position 40
        const title = `${'a'.repeat(39)} bcdef`;
        const slug = buildNewsletterCampaignSlug({ title, id });

        expect(slug).toBe(`${'a'.repeat(39)}-0f3a9c2e`);
        expect(slug.length).toBeLessThanOrEqual(49);
    });

    it('caps a long title at 40 chars', () => {
        const slug = buildNewsletterCampaignSlug({ title: 'x'.repeat(80), id });

        expect(slug).toBe(`${'x'.repeat(40)}-0f3a9c2e`);
    });

    it('falls back to newsletter-<id8> on an empty title', () => {
        expect(buildNewsletterCampaignSlug({ title: '  ¡¡!! ', id })).toBe('newsletter-0f3a9c2e');
    });

    it('prefixes the pixel slug', () => {
        expect(buildNewsletterPixelSlug({ campaignSlug: 'otono-0f3a9c2e' })).toBe(
            'newsletter-otono-0f3a9c2e'
        );
    });
});
