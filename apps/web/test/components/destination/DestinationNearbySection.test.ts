/**
 * @file DestinationNearbySection.test.ts
 * @description Source-based assertions for DestinationNearbySection.astro.
 * Astro components cannot be DOM-rendered in Vitest; we assert on source content.
 *
 * Coverage:
 * - imports (DestinationCard, toDestinationCardProps, i18n)
 * - props interface (destinations, locale)
 * - early return when destinations array is empty
 * - cap at MAX_VISIBLE (4)
 * - toDestinationCardProps transform applied to each item
 * - DestinationCard rendered with variant="grid"
 * - no visitor-dependent props forwarded to the card (HOS-369 WB0-5)
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

        it('no longer declares isAuthenticated/favoriteChecks props (removed HOS-369 WB0-5)', () => {
            expect(src).not.toContain('isAuthenticated');
            expect(src).not.toContain('favoriteChecks');
        });
    });

    describe('rendering', () => {
        it('should return early when destinations array is empty', () => {
            expect(src).toContain('destinations.length === 0');
            expect(src).toContain('return');
        });

        it('should cap visible destinations at MAX_VISIBLE = 4', () => {
            expect(src).toContain('MAX_VISIBLE = 4');
            expect(src).toContain("variant = 'nearby'");
            expect(src).toContain("const isCities = variant === 'cities'");
            expect(src).toContain('.slice(0, isCities ? undefined : MAX_VISIBLE)');
        });

        it('should apply toDestinationCardProps transform to each destination', () => {
            expect(src).toContain('toDestinationCardProps({ item, locale })');
        });

        it('should render DestinationCard with variant="grid"', () => {
            expect(src).toContain('variant="grid"');
        });

        it('does NOT forward isAuthenticated/initialIsFavorited/initialBookmarkId to DestinationCard — resolves client-side (HOS-369 WB0-5)', () => {
            expect(src).not.toMatch(/<DestinationCard[\s\S]*?isAuthenticated=/);
            expect(src).not.toMatch(/<DestinationCard[\s\S]*?initialIsFavorited=/);
            expect(src).not.toMatch(/<DestinationCard[\s\S]*?initialBookmarkId=/);
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
            const { detail } = JSON.parse(
                readFileSync(
                    resolve(
                        __dirname,
                        '../../../../../packages/i18n/src/locales/es/destination.json'
                    ),
                    'utf8'
                )
            );
            expect(detail.nearby.title).toBe('Otros destinos en la zona');
            expect(detail.nearby.subtitle).toMatch(/^Cercanos en la región\b/);
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for section title', () => {
            expect(src).toContain("'destinations.detail.nearby.title'");
        });

        it('uses the localized cities heading instead of the nearby heading for cities', () => {
            expect(src).toMatch(
                /isCities\s*\?\s*t\('destinations\.detail\.nearby\.exploreCities'\)\s*:\s*t\('destinations\.detail\.nearby\.title'\)/
            );
        });

        it('should use t() for subtitle', () => {
            expect(src).toContain("'destinations.detail.nearby.subtitle'");
        });

        it('shows the localized regional subtitle only for nearby, without inline fallback copy', () => {
            expect(src).toMatch(
                /!isCities\s*&&\s*<p[^>]*>\s*\{t\('destinations\.detail\.nearby\.subtitle'\)\}/
            );
        });
    });

    describe('accessibility', () => {
        it('labels each section with its own heading, preserving the nearby and cities anchors', () => {
            expect(src).toContain(
                "const headingId = isCities ? 'destination-cities' : 'dest-nearby-title'"
            );
            expect(src).toMatch(/<section[^>]*aria-labelledby=\{headingId\}/);
            expect(src).toMatch(/<h2[^>]*\bid=\{headingId\}/);
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
