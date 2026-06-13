/**
 * @file DestinationNearbySection.test.ts
 * @description Source-based assertions for DestinationNearbySection.astro.
 * Astro components cannot be DOM-rendered in Vitest; we assert on source content.
 *
 * Coverage:
 * - imports (DestinationCard, toDestinationCardProps, i18n)
 * - props interface (destinations, locale, isAuthenticated)
 * - early return when destinations array is empty
 * - cap at MAX_VISIBLE (4)
 * - toDestinationCardProps transform applied to each item
 * - DestinationCard rendered with variant="grid"
 * - isAuthenticated forwarded to card
 * - copy does NOT use "destinos cercanos" or km-radius language
 * - i18n keys for title and subtitle
 * - accessibility (aria-labelledby + id)
 * - responsive grid (1/2/3/4 columns)
 * - CSS custom property usage
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationNearbySection.astro'),
    'utf8'
);

describe('DestinationNearbySection.astro', () => {
    describe('imports', () => {
        it('should import DestinationCard from shared cards', () => {
            expect(src).toContain("from '@/components/shared/cards/DestinationCard.astro'");
            expect(src).toContain('DestinationCard');
        });

        it('should import toDestinationCardProps from transforms', () => {
            expect(src).toContain("from '@/lib/api/transforms'");
            expect(src).toContain('toDestinationCardProps');
        });

        it('should import createTranslations and SupportedLocale from @/lib/i18n', () => {
            expect(src).toContain("from '@/lib/i18n'");
            expect(src).toContain('createTranslations');
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props', () => {
        it('should declare destinations as ReadonlyArray<unknown>', () => {
            expect(src).toContain('readonly destinations: ReadonlyArray<unknown>');
        });

        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('should declare isAuthenticated as optional boolean defaulting to false', () => {
            expect(src).toContain('readonly isAuthenticated?: boolean');
            expect(src).toContain('isAuthenticated = false');
        });
    });

    describe('rendering', () => {
        it('should return early when destinations array is empty', () => {
            expect(src).toContain('destinations.length === 0');
            expect(src).toContain('return');
        });

        it('should cap visible destinations at MAX_VISIBLE = 4', () => {
            expect(src).toContain('MAX_VISIBLE = 4');
            expect(src).toContain('.slice(0, MAX_VISIBLE)');
        });

        it('should apply toDestinationCardProps transform to each destination', () => {
            expect(src).toContain('toDestinationCardProps({ item, locale })');
        });

        it('should render DestinationCard with variant="grid"', () => {
            expect(src).toContain('variant="grid"');
        });

        it('should forward isAuthenticated to DestinationCard', () => {
            expect(src).toContain('isAuthenticated={isAuthenticated}');
        });

        it('should forward locale to DestinationCard', () => {
            expect(src).toContain('locale={locale}');
        });
    });

    describe('copy correctness', () => {
        it('should NOT use "destinos cercanos" (deceptive km-proximity language)', () => {
            expect(src).not.toContain('destinos cercanos');
        });

        it('should NOT use "cercanos" alone as a geographic claim', () => {
            // The phrase "Cercanos en la región" is OK; "Cercanos" standalone claim is not.
            // We check the subtitle uses the approved wording.
            expect(src).toContain('en la región');
        });

        it('should use "en la zona" or "en la región" in the section content', () => {
            const hasZone = src.includes('en la zona') || src.includes('en la región');
            expect(hasZone).toBe(true);
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for section title', () => {
            expect(src).toContain("'destination.detail.nearby.title'");
        });

        it('should include Spanish fallback for section title', () => {
            expect(src).toContain('Otros destinos en la zona');
        });

        it('should use t() for subtitle', () => {
            expect(src).toContain("'destination.detail.nearby.subtitle'");
        });

        it('should include Spanish fallback for subtitle', () => {
            expect(src).toContain('Cercanos en la región');
        });
    });

    describe('accessibility', () => {
        it('should label section with aria-labelledby="dest-nearby-title"', () => {
            expect(src).toContain('aria-labelledby="dest-nearby-title"');
        });

        it('should provide matching id on the section heading', () => {
            expect(src).toContain('id="dest-nearby-title"');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties only (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should use --core-foreground for title text', () => {
            expect(src).toContain('var(--core-foreground)');
        });

        it('should use --core-muted-foreground for subtitle text', () => {
            expect(src).toContain('var(--core-muted-foreground)');
        });

        it('should use a 1/2/3/4-col responsive grid', () => {
            expect(src).toContain('repeat(2, 1fr)');
            expect(src).toContain('repeat(3, 1fr)');
            expect(src).toContain('repeat(4, 1fr)');
        });
    });
});
