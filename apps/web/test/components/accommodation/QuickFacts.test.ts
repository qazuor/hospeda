import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/QuickFacts.astro'),
    'utf8'
);

describe('QuickFacts mobile summary', () => {
    it('shows the compact facts in one line at 767px and retains the desktop pills', () => {
        const mobileStyles = source.split('@media (max-width: 767px)')[1];

        expect(mobileStyles).toMatch(/\.quick-facts\s*\{\s*display: none/);
        expect(mobileStyles).toMatch(
            /\.quick-facts__compact\s*\{[^}]*display: block;[^}]*overflow-x: auto;[^}]*white-space: nowrap;/
        );
        expect(source).toMatch(
            /class="quick-facts__compact"[^>]*>\s*\{compactFacts\.join\(' · '\)\}/
        );
        expect(source).toMatch(/\.quick-facts__compact\s*\{\s*display: none/);
    });

    it.each([
        ['es', '7 huéspedes · 3 hab · 5 camas · 2 baños'],
        ['en', '7 guests · 3 rooms · 5 beds · 2 baths'],
        ['pt', '7 hóspedes · 3 quartos · 5 camas · 2 banheiros']
    ] as const)('localizes the compact row in %s', (locale, expected) => {
        const { tPlural } = createTranslations(locale);
        const facts = [
            ...source.matchAll(
                /tPlural\('accommodations.detail.quickFacts.(guests|compactBedrooms|compactBeds|compactBathrooms)', extraInfo\.(\w+)\)/g
            )
        ].slice(0, 4);
        const counts: Record<string, number> = { capacity: 7, bedrooms: 3, beds: 5, bathrooms: 2 };

        const row = facts
            .map(([, key, field]) =>
                tPlural(`accommodations.detail.quickFacts.${key}`, counts[field] ?? 0)
            )
            .join(' · ');

        expect(row).toBe(expected);
    });

    it('gives the compact facts scroller a tab stop, accessible name and visible focus ring', () => {
        const scroller = source.match(/<div\s+class="quick-facts__compact"[^>]*>/)?.[0];
        const mobileStyles = source.split('@media (max-width: 767px)')[1];

        expect.soft(scroller).toContain('tabindex="0"');
        expect.soft(scroller).toContain('role="group"');
        expect
            .soft(scroller)
            .toContain("aria-label={t('accommodations.detail.quickFacts.scrollLabel')}");
        expect(mobileStyles).toMatch(
            /\.quick-facts__compact:focus-visible\s*\{[^}]*outline: 2px solid var\(--brand-primary\);/
        );
    });

    it.each([
        ['es', 'Datos del alojamiento'],
        ['en', 'Accommodation facts'],
        ['pt', 'Dados da hospedagem']
    ] as const)('localizes the compact facts scroller name in %s', (locale, expected) => {
        const { t } = createTranslations(locale);

        expect(t('accommodations.detail.quickFacts.scrollLabel')).toBe(expected);
    });
});
