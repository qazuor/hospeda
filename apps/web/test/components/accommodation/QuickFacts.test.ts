import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/QuickFacts.astro'),
    'utf8'
);

describe('QuickFacts mobile summary', () => {
    it('shows the compact facts on mobile and retains the desktop pills', () => {
        const mobileStyles = source.split('@media (max-width: 767px)')[1];

        expect(mobileStyles).toMatch(/\.quick-facts\s*\{\s*display: none/);
        expect(source).toMatch(/\.quick-facts__compact\s*\{\s*display: none/);
    });

    it('wraps a long row between facts instead of clipping it', () => {
        const mobileStyles = source.split('@media (max-width: 767px)')[1] ?? '';
        const row = mobileStyles.match(/\.quick-facts__compact\s*\{[^}]*\}/)?.[0] ?? '';

        // Regression: the row used `white-space: nowrap` + `overflow-x: auto`,
        // which hid the last facts (minimum stay) off the right edge.
        expect(row).toContain('flex-wrap: wrap;');
        expect(row).not.toContain('nowrap');
        expect(row).not.toContain('overflow-x');
        expect(mobileStyles).toMatch(/\.quick-facts__compact-item\s*\{[^}]*white-space: nowrap;/);
        expect(source).toMatch(
            /compactFacts\.map\(\(fact, index\) => \(\s*<span class="quick-facts__compact-item">\{index < compactFacts\.length - 1 \? `\$\{fact\} ·` : fact\}<\/span>/
        );
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

    it('names the compact facts group and no longer makes it a tab stop', () => {
        const group = source.match(/<div\s+class="quick-facts__compact"[^>]*>/)?.[0];

        // Nothing scrolls any more, so a tab stop would be an empty stop.
        expect.soft(group).not.toContain('tabindex');
        expect.soft(group).toContain('role="group"');
        expect
            .soft(group)
            .toContain("aria-label={t('accommodations.detail.quickFacts.scrollLabel')}");
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
