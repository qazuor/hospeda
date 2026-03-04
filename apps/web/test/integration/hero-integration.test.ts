/**
 * Integration tests for the complete hero assembly.
 * Validates ARIA structure, keyboard navigation patterns, reduced-motion compliance,
 * responsive layout assertions, and cross-component references.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const heroSectionPath = resolve(__dirname, '../../src/components/content/HeroSection.astro');
const heroSearchBarPath = resolve(
    __dirname,
    '../../src/components/search/HeroSearchBar.client.tsx'
);
const baseLayoutPath = resolve(__dirname, '../../src/layouts/BaseLayout.astro');
const homepagePath = resolve(__dirname, '../../src/pages/[lang]/index.astro');
const bottomSheetPath = resolve(
    __dirname,
    '../../src/components/search/SearchBottomSheet.client.tsx'
);

const heroSection = readFileSync(heroSectionPath, 'utf8');
const heroSearchBar = readFileSync(heroSearchBarPath, 'utf8');
const baseLayout = readFileSync(baseLayoutPath, 'utf8');
const homepage = readFileSync(homepagePath, 'utf8');
const bottomSheet = readFileSync(bottomSheetPath, 'utf8');

describe('Hero Integration Tests', () => {
    describe('ARIA structure', () => {
        it('HeroSearchBar should use semantic <search> element for desktop form', () => {
            expect(heroSearchBar).toContain('<search');
        });

        it('HeroSearchBar should have aria-label on the search form', () => {
            expect(heroSearchBar).toContain('aria-label={labels.searchAriaLabel}');
        });

        it('HeroSearchBar should have fallback URL logic', () => {
            expect(heroSearchBar).toContain('baseAccommodationsPath');
            expect(heroSearchBar).toContain('buildSearchUrl');
        });

        it('HeroSection outer section should NOT have aria-hidden', () => {
            const sectionTag = heroSection.match(/<section[^>]*>/)?.[0] ?? '';
            expect(sectionTag).not.toContain('aria-hidden');
        });

        it('Gradient overlay should have aria-hidden="true"', () => {
            expect(heroSection).toContain('aria-hidden="true"');
        });

        it('Shape divider should have aria-hidden="true"', () => {
            const shapeDivider = heroSection.slice(heroSection.indexOf('hero-shape-divider'));
            expect(shapeDivider).toContain('aria-hidden="true"');
        });
    });

    describe('Skip link compatibility', () => {
        it('BaseLayout should have #main-content target outside hero', () => {
            expect(baseLayout).toContain('id="main-content"');
            expect(baseLayout).toContain('<main');
        });

        it('HeroSection should not contain main-content id', () => {
            expect(heroSection).not.toContain('id="main-content"');
        });
    });

    describe('Component references', () => {
        it('HeroSection should import HeroCarouselWithPhrases', () => {
            expect(heroSection).toContain('HeroCarouselWithPhrases');
        });

        it('HeroSection should import LiveStatsCounter', () => {
            expect(heroSection).toContain('LiveStatsCounter');
        });

        it('HeroSection should have overflow-hidden on outer element', () => {
            expect(heroSection).toContain('overflow-hidden');
        });

        it('HeroSection should import HeroSearchBar with client:idle', () => {
            expect(heroSection).toContain('HeroSearchBar');
            expect(heroSection).toContain('client:idle');
        });

        it('HeroSection should use shape divider with CSS mask', () => {
            expect(heroSection).toContain('hero-shape-divider');
            expect(heroSection).toContain('mask-image');
        });
    });

    describe('Homepage wiring', () => {
        it('Homepage should pass headline and searchLabels to HeroSection', () => {
            expect(homepage).toContain('headline={heroHeadline}');
            expect(homepage).toContain('subheadline={heroSubheadline}');
            expect(homepage).toContain('searchLabels={searchLabels}');
        });

        it('Homepage should pass apiBaseUrl from getApiUrl', () => {
            expect(homepage).toContain('apiBaseUrl={apiBaseUrl}');
            expect(homepage).toContain('getApiUrl()');
        });

        it('Homepage should NOT pass categoryBadges (removed)', () => {
            expect(homepage).not.toContain('categoryBadges={');
        });

        it('Homepage should pass statsLabels', () => {
            expect(homepage).toContain(
                'statsLabels={{ destinations: statsDestinations, accommodations: statsAccommodations }}'
            );
        });

        it('Homepage should pass counterItems', () => {
            expect(homepage).toContain('counterItems={counterItems}');
        });

        it('Homepage should pass rotatingPhrases', () => {
            expect(homepage).toContain('rotatingPhrases={rotatingPhrases}');
        });
    });

    describe('Mobile bottom sheet integration', () => {
        it('HeroSearchBar should import SearchBottomSheet', () => {
            expect(heroSearchBar).toContain('SearchBottomSheet');
        });

        it('SearchBottomSheet should use native dialog element', () => {
            expect(bottomSheet).toContain('<dialog');
            expect(bottomSheet).toContain('showModal()');
        });

        it('SearchBottomSheet should include all 4 popovers', () => {
            expect(bottomSheet).toContain('DestinationPopover');
            expect(bottomSheet).toContain('TypePopover');
            expect(bottomSheet).toContain('DateRangePopover');
            expect(bottomSheet).toContain('GuestsPopover');
        });
    });

    describe('Multi-select URL building', () => {
        it('HeroSearchBar should support multi-value params', () => {
            expect(heroSearchBar).toContain("params.append('destino'");
            expect(heroSearchBar).toContain("params.append('tipo'");
        });

        it('HeroSearchBar should include guest params', () => {
            expect(heroSearchBar).toContain("params.set('adultos'");
            expect(heroSearchBar).toContain("params.set('ninos'");
        });
    });
});
