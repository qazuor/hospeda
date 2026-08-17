/**
 * @file photo-credit.test.ts
 * @description Tests for the shared photo-credit formatter (H-125).
 *
 * The formatter exists so the SSR photo page and the React lightbox phrase the
 * same credit the same way. What it must never do is name a provider the photo
 * did not come from, or hand a non-http URL to an `href`.
 */

import { describe, expect, it } from 'vitest';
import { formatPhotoCredit } from '../../src/lib/photo-credit';

/** Translator stub: returns the fallback with `{{params}}` interpolated. */
const t = (key: string, fallback?: string, params?: Record<string, string | number>) => {
    const raw = fallback ?? key;
    if (!params) return raw;
    return Object.keys(params).reduce(
        (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
        raw
    );
};

describe('formatPhotoCredit', () => {
    it('returns undefined when there is no credit at all', () => {
        expect(formatPhotoCredit(undefined, t)).toBeUndefined();
    });

    it('returns undefined when the credit names nobody', () => {
        expect(formatPhotoCredit({ license: 'CC BY 4.0' }, t)).toBeUndefined();
        expect(formatPhotoCredit({ sourceUrl: 'https://example.com' }, t)).toBeUndefined();
    });

    it('names the provider for a stock import', () => {
        const parts = formatPhotoCredit(
            {
                photographer: 'John Doe',
                sourceUrl: 'https://unsplash.com/@johndoe',
                license: 'Unsplash License',
                provider: 'unsplash'
            },
            t
        );

        expect(parts?.photographer).toBe('John Doe');
        expect(parts?.providerSuffix).toBe('en Unsplash');
        expect(parts?.url).toBe('https://unsplash.com/@johndoe');
        expect(parts?.ariaLabel).toBe('Perfil de John Doe en Unsplash');
    });

    it("names NO provider for a host's own photo", () => {
        const parts = formatPhotoCredit(
            { photographer: 'Estudio Paraná', provider: 'user-upload' },
            t
        );

        // The old renderer defaulted every non-Unsplash value to 'Pexels',
        // which would publish a false claim about the photo's origin.
        expect(parts?.providerSuffix).toBe('');
        expect(parts?.ariaLabel).toBe('Sitio de Estudio Paraná');
    });

    it('leaves the url absent when the credit has no link', () => {
        const parts = formatPhotoCredit({ photographer: 'Ana Gómez' }, t);

        expect(parts?.photographer).toBe('Ana Gómez');
        expect(parts?.url).toBeUndefined();
    });

    it('refuses a non-http link rather than putting it in an href', () => {
        const parts = formatPhotoCredit(
            { photographer: 'Mallory', sourceUrl: 'javascript:alert(1)' },
            t
        );

        expect(parts?.photographer).toBe('Mallory');
        expect(parts?.url).toBeUndefined();
    });

    it('trims a padded photographer name', () => {
        const parts = formatPhotoCredit({ photographer: '  Ana Gómez  ' }, t);
        expect(parts?.photographer).toBe('Ana Gómez');
    });

    it('treats a whitespace-only name as no credit', () => {
        expect(formatPhotoCredit({ photographer: '   ' }, t)).toBeUndefined();
    });
});
