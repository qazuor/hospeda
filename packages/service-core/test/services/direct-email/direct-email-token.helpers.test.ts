import { describe, expect, it } from 'vitest';
import {
    buildDirectEmailOptOutUrl,
    DIRECT_EMAIL_NON_FUNCTIONAL_OPT_OUT_TOKEN,
    generateDirectEmailOptOutToken,
    maskEmail
} from '../../../src/services/direct-email/direct-email-token.helpers.js';

describe('generateDirectEmailOptOutToken', () => {
    it('is 32 random bytes in base64url (43 characters) and never repeats', () => {
        const tokens = Array.from({ length: 50 }, () => generateDirectEmailOptOutToken());

        for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(new Set(tokens).size).toBe(50);
    });

    it('is never the fixed non-functional test token', () => {
        expect(generateDirectEmailOptOutToken()).not.toBe(
            DIRECT_EMAIL_NON_FUNCTIONAL_OPT_OUT_TOKEN
        );
    });
});

describe('maskEmail', () => {
    it('keeps the first letter and the domain', () => {
        expect(maskEmail('juan@example.com')).toBe('j***@example.com');
    });

    it('masks a malformed address entirely', () => {
        expect(maskEmail('nope')).toBe('***');
    });
});

describe('buildDirectEmailOptOutUrl', () => {
    it('builds the localized page URL with the encoded token', () => {
        expect(
            buildDirectEmailOptOutUrl({ siteUrl: 'https://hospeda.com.ar/', token: 'a b' })
        ).toBe('https://hospeda.com.ar/es/correos/baja/?token=a%20b');
    });

    it('honours the locale', () => {
        expect(
            buildDirectEmailOptOutUrl({ siteUrl: 'https://x.test', token: 't', locale: 'en' })
        ).toBe('https://x.test/en/correos/baja/?token=t');
    });
});
