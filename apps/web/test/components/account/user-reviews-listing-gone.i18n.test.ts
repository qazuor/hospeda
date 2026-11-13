/**
 * @file user-reviews-listing-gone.i18n.test.ts
 * @description Locale copy for the deleted listing notice (HOS-1706).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
const EXPECTED = {
    es: 'La ficha ya no existe',
    en: 'This listing no longer exists',
    pt: 'Este anúncio não existe mais'
} as const;

function readListingGone({ locale }: { readonly locale: (typeof LOCALES)[number] }): unknown {
    const account = JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../../packages/i18n/src/locales/${locale}/account.json`),
            'utf8'
        )
    ) as { readonly reviews: { readonly listingGone?: unknown } };
    return account.reviews.listingGone;
}

describe('account.reviews.listingGone (HOS-1706)', () => {
    it.each(LOCALES)('TEST:1706:4 — %s has the exact deleted listing notice', (locale) => {
        const copy = readListingGone({ locale });
        expect(typeof copy).toBe('string');
        expect((copy as string).trim().length).toBeGreaterThan(0);
        expect(copy).toBe(EXPECTED[locale]);
    });

    it('uses distinct copy in all three locales', () => {
        expect(new Set(LOCALES.map((locale) => readListingGone({ locale }))).size).toBe(3);
    });
});
