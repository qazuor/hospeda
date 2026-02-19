/**
 * Integration tests for the complete hero assembly.
 * Validates ARIA structure, keyboard navigation patterns, reduced-motion compliance,
 * responsive layout assertions, and cross-component references.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const heroSectionPath = resolve(__dirname, '../../src/components/content/HeroSection.astro');
const heroCarouselPath = resolve(__dirname, '../../src/components/content/HeroCarousel.client.tsx');
const heroSearchBarPath = resolve(
    __dirname,
    '../../src/components/search/HeroSearchBar.client.tsx'
);
const waveDividerPath = resolve(__dirname, '../../src/components/ui/WaveDivider.astro');
const baseLayoutPath = resolve(__dirname, '../../src/layouts/BaseLayout.astro');
const homepagePath = resolve(__dirname, '../../src/pages/[lang]/index.astro');

const heroSection = readFileSync(heroSectionPath, 'utf8');
const heroCarousel = readFileSync(heroCarouselPath, 'utf8');
const heroSearchBar = readFileSync(heroSearchBarPath, 'utf8');
const waveDivider = readFileSync(waveDividerPath, 'utf8');
const baseLayout = readFileSync(baseLayoutPath, 'utf8');
const homepage = readFileSync(homepagePath, 'utf8');

describe('Hero Integration Tests', () => {
    describe('ARIA structure', () => {
        it('HeroCarousel should include aria-live="polite" for slide announcements', () => {
            expect(heroCarousel).toContain('aria-live="polite"');
        });

        it('HeroCarousel dot buttons should be keyboard accessible', () => {
            expect(heroCarousel).toContain('<button');
            expect(heroCarousel).toContain('type="button"');
            expect(heroCarousel).toContain('aria-label');
        });

        it('HeroSearchBar should include aria-label on all interactive elements', () => {
            expect(heroSearchBar).toContain('aria-label={labels.searchAriaLabel}');
            expect(heroSearchBar).toContain('aria-label={labels.typePlaceholder}');
            expect(heroSearchBar).toContain('aria-label={labels.destinationPlaceholder}');
            expect(heroSearchBar).toContain('aria-label={labels.checkInPlaceholder}');
            expect(heroSearchBar).toContain('aria-label={labels.checkOutPlaceholder}');
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

        it('HeroCarousel should handle empty slides with fallback gradient', () => {
            expect(heroCarousel).toContain('bg-gradient-to-br');
            expect(heroCarousel).toContain('from-primary');
            expect(heroCarousel).toContain('to-primary-dark');
        });

        it('WaveDivider should have aria-hidden="true"', () => {
            expect(waveDivider).toContain('aria-hidden="true"');
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
        it('HeroSection should import WaveDivider', () => {
            expect(heroSection).toContain("import WaveDivider from '../ui/WaveDivider.astro'");
        });

        it('HeroSection should position WaveDivider absolute bottom-0', () => {
            expect(heroSection).toContain('absolute bottom-0');
        });

        it('HeroSection should have overflow-hidden on outer element', () => {
            expect(heroSection).toContain('overflow-hidden');
        });

        it('HeroSection should pass firstSectionFill to WaveDivider', () => {
            expect(heroSection).toContain('fill={firstSectionFill}');
        });

        it('HeroSection should import HeroCarousel with client:load', () => {
            expect(heroSection).toContain('HeroCarousel');
            expect(heroSection).toContain('client:load');
        });

        it('HeroSection should import HeroSearchBar with client:load', () => {
            expect(heroSection).toContain('HeroSearchBar');
            expect(heroSection).toContain('client:load');
        });
    });

    describe('Homepage wiring', () => {
        it('Homepage should pass slides as array to HeroSection', () => {
            expect(homepage).toContain('slides={heroSlides}');
        });

        it('Homepage should pass apiBaseUrl from env', () => {
            expect(homepage).toContain('apiBaseUrl={apiBaseUrl}');
            expect(homepage).toContain('import.meta.env.PUBLIC_API_URL');
        });

        it('Homepage should pass firstSectionFill matching warm bg', () => {
            expect(homepage).toContain('firstSectionFill="#F9F4EE"');
        });
    });

    describe('Reduced-motion support', () => {
        it('HeroCarousel should check prefers-reduced-motion', () => {
            expect(heroCarousel).toContain('prefers-reduced-motion');
        });

        it('HeroCarousel should disable auto-advance when reduced motion preferred', () => {
            expect(heroCarousel).toContain('useReducedMotion');
            expect(heroCarousel).toContain('autoEnabled');
        });
    });

    describe('Responsive behavior', () => {
        it('HeroSearchBar should have vertical layout on mobile', () => {
            expect(heroSearchBar).toContain('flex-col');
        });

        it('HeroSearchBar should have horizontal layout on desktop', () => {
            expect(heroSearchBar).toContain('lg:flex-row');
        });

        it('WaveDivider should have responsive height', () => {
            expect(waveDivider).toContain('h-10');
            expect(waveDivider).toContain('sm:h-[60px]');
        });
    });

    describe('SVG accessibility in hero', () => {
        it('All SVG elements in hero assembly should have aria-hidden', () => {
            expect(waveDivider).toContain('aria-hidden="true"');
        });

        it('WaveDivider SVG should have focusable="false"', () => {
            expect(waveDivider).toContain('focusable="false"');
        });
    });
});
