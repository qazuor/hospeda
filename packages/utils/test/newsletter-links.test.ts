import { describe, expect, it } from 'vitest';
import {
    buildNewsletterUnsubscribeApiUrl,
    buildNewsletterUnsubscribePageUrl
} from '../src/newsletter-links';

describe('buildNewsletterUnsubscribePageUrl', () => {
    it('builds the localized page url with the token', () => {
        const url = buildNewsletterUnsubscribePageUrl({
            siteUrl: 'https://hospeda.com.ar/',
            locale: 'en',
            token: 'a-b_c'
        });
        expect(url).toBe('https://hospeda.com.ar/en/newsletter/unsubscribe/?token=a-b_c');
    });

    it('omits the query when there is no token', () => {
        const url = buildNewsletterUnsubscribePageUrl({
            siteUrl: 'https://hospeda.com.ar',
            locale: 'es'
        });
        expect(url).toBe('https://hospeda.com.ar/es/newsletter/unsubscribe/');
    });

    it('encodes unsafe token characters', () => {
        const url = buildNewsletterUnsubscribePageUrl({
            siteUrl: 'https://x.test',
            locale: 'pt',
            token: 'a b&c'
        });
        expect(url).toContain('?token=a%20b%26c');
    });
});

describe('buildNewsletterUnsubscribeApiUrl', () => {
    it('points at the public API endpoint', () => {
        expect(
            buildNewsletterUnsubscribeApiUrl({ apiUrl: 'https://api.x.test/', token: 't' })
        ).toBe('https://api.x.test/api/v1/public/newsletter/unsubscribe?token=t');
    });
});
