/**
 * @file hero-integration.test.ts
 * @description Integration tests verifying composition between the homepage,
 * HeroSection, hero data file, HeroSearchForm, and HeroSlideshow.
 *
 * These tests validate that:
 * - The homepage imports and uses HeroSection
 * - HeroSection imports and uses HeroSearchForm and HeroSlideshow
 * - The hero data file exports the expected constants with correct structure
 * - HeroSection receives the locale prop from the homepage
 * - The slideshow and search form are connected via the shared data file
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const WEB_ROOT = resolve(__dirname, '../../');
const SRC = resolve(WEB_ROOT, 'src');

const HOMEPAGE_PATH = resolve(SRC, 'pages/[lang]/index.astro');
const HERO_SECTION_PATH = resolve(SRC, 'components/sections/HeroSection.astro');
const HERO_DATA_PATH = resolve(SRC, 'data/hero.ts');

// ---------------------------------------------------------------------------
// Source fixtures (read once, shared across tests)
// ---------------------------------------------------------------------------

const homepageSrc = readFileSync(HOMEPAGE_PATH, 'utf8');
const heroSectionSrc = readFileSync(HERO_SECTION_PATH, 'utf8');
const heroDataSrc = readFileSync(HERO_DATA_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hero-integration', () => {
    describe('homepage -> HeroSection composition', () => {
        it('homepage should import HeroSection from the sections directory', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain(
                "import HeroSection from '../../components/sections/HeroSection.astro'"
            );
        });

        it('homepage should render <HeroSection> in the template', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('<HeroSection');
        });

        it('homepage should pass locale prop to HeroSection', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('<HeroSection locale={locale}');
        });

        it('homepage should import HERO_IMAGE_SOURCES from the hero data file', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('import { HERO_IMAGE_SOURCES }');
            expect(homepageSrc).toContain("from '../../data/hero'");
        });

        it('homepage should use HERO_IMAGE_SOURCES to generate the hero image preload link', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('HERO_IMAGE_SOURCES[0]');
            expect(homepageSrc).toContain('heroPreloadSrc');
            expect(homepageSrc).toContain('rel="preload"');
            expect(homepageSrc).toContain('as="image"');
        });
    });

    describe('HeroSection -> sub-component composition', () => {
        it('HeroSection should import HeroSearchForm from the hero components directory', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('HeroSearchForm');
            expect(heroSectionSrc).toContain('from "@/components/hero/HeroSearchForm"');
        });

        it('HeroSection should import HeroSlideshow from the hero components directory', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('HeroSlideshow');
            expect(heroSectionSrc).toContain('from "@/components/hero/HeroSlideshow"');
        });

        it('HeroSection should import HERO_IMAGE_SOURCES and SLIDE_SECONDS from the data file', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('HERO_IMAGE_SOURCES');
            expect(heroSectionSrc).toContain('SLIDE_SECONDS');
            expect(heroSectionSrc).toContain('from "@/data/hero"');
        });

        it('HeroSection should render the <HeroSlideshow> island with client:idle directive', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('<HeroSlideshow');
            expect(heroSectionSrc).toContain('client:idle');
        });

        it('HeroSection should pass images and interval props to HeroSlideshow', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('images={slideshowImages}');
            expect(heroSectionSrc).toContain('interval={SLIDE_SECONDS * 1000}');
        });

        it('HeroSection should render the <HeroSearchForm> island with client:idle directive', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('<HeroSearchForm');
            expect(heroSectionSrc).toContain('client:idle');
        });

        it('HeroSection should wrap the search form in an identifiable container', () => {
            // Arrange / Act / Assert
            // The scroll fade-out script targets this id
            expect(heroSectionSrc).toContain('id="hero-search-form"');
        });
    });

    describe('hero data file structure', () => {
        it('should export HERO_IMAGE_SOURCES as a named export', () => {
            // Arrange / Act / Assert
            expect(heroDataSrc).toContain('export const HERO_IMAGE_SOURCES');
        });

        it('should export SLIDE_SECONDS as a named constant', () => {
            // Arrange / Act / Assert
            expect(heroDataSrc).toContain('export const SLIDE_SECONDS');
        });

        it('SLIDE_SECONDS should be a numeric literal marked as const', () => {
            // Arrange / Act / Assert
            expect(heroDataSrc).toMatch(/SLIDE_SECONDS\s*=\s*\d+\s*as const/);
        });

        it('HERO_IMAGE_SOURCES should be declared as const (immutable tuple)', () => {
            // Arrange / Act / Assert
            expect(heroDataSrc).toContain('] as const;');
        });

        it('each hero image entry should have src and alt properties', () => {
            // Arrange / Act / Assert
            expect(heroDataSrc).toContain('{ src:');
            expect(heroDataSrc).toContain('alt:');
        });

        it('should import at least 10 hero images', () => {
            // Arrange
            const importMatches = heroDataSrc.match(/^import hero\d+/gm) ?? [];

            // Act / Assert
            expect(importMatches.length).toBeGreaterThanOrEqual(10);
        });

        it('hero image entries should describe Argentine Litoral region locations', () => {
            // Arrange / Act / Assert - alt texts must reference the real region
            expect(heroDataSrc).toContain('Rio Uruguay');
        });
    });

    describe('HeroSection scroll behaviour integration', () => {
        it('HeroSection should have a scroll indicator element with an identifiable id', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('id="hero-scroll-indicator"');
        });

        it('HeroSection should register a scroll event listener for fade-out effects', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain("window.addEventListener('scroll'");
        });

        it('HeroSection should re-initialize scroll effects on Astro page-load event', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain("document.addEventListener('astro:page-load'");
        });
    });

    describe('HeroSection accessibility', () => {
        it('HeroSection should use a <section> semantic element as the root', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('<section');
        });

        it('HeroSection should render an <h1> heading', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('<h1');
        });

        it('HeroSection scroll indicator link should have an aria-label', () => {
            // Arrange / Act / Assert
            expect(heroSectionSrc).toContain('aria-label=');
        });
    });
});
