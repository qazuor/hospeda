/**
 * Tests for HeroSection component.
 * Validates fullscreen carousel layout, content positioning,
 * category badges, animated counter, scroll indicator, and accessibility.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/HeroSection.astro');
const content = readFileSync(componentPath, 'utf8');

describe('HeroSection.astro', () => {
    describe('Props interface', () => {
        it('should define HeroSectionProps export', () => {
            expect(content).toContain('HeroSectionProps');
        });

        it('should accept optional heroImage prop', () => {
            expect(content).toContain('heroImage?');
        });

        it('should accept accentSubtitle prop', () => {
            expect(content).toContain('accentSubtitle: string');
        });

        it('should accept headline prop', () => {
            expect(content).toContain('headline: string');
        });

        it('should accept subheadline prop', () => {
            expect(content).toContain('subheadline: string');
        });

        it('should accept searchLabels prop', () => {
            expect(content).toContain('searchLabels:');
        });

        it('should accept locale prop', () => {
            expect(content).toContain("locale: 'es' | 'en' | 'pt'");
        });

        it('should accept apiBaseUrl prop', () => {
            expect(content).toContain('apiBaseUrl: string');
        });

        it('should NOT have categoryBadges prop (removed)', () => {
            expect(content).not.toContain('categoryBadges');
        });

        it('should accept optional counterItems prop', () => {
            expect(content).toContain('counterItems?');
        });

        it('should accept optional rotatingPhrases prop', () => {
            expect(content).toContain('rotatingPhrases?');
        });

        it('should NOT have socialProofText prop (removed)', () => {
            expect(content).not.toContain('socialProofText');
        });
    });

    describe('Fullscreen layout', () => {
        it('should use section as root element', () => {
            expect(content).toContain('<section');
        });

        it('should have overflow-hidden on section', () => {
            expect(content).toContain('overflow-hidden');
        });

        it('should have min-h with 100svh constraint', () => {
            expect(content).toContain('min-h-[max(100svh,600px)]');
        });

        it('should center content vertically with justify-center', () => {
            expect(content).toContain('justify-center');
        });
    });

    describe('Carousel integration', () => {
        it('should import HeroCarouselWithPhrases', () => {
            expect(content).toContain('HeroCarouselWithPhrases');
        });

        it('should use client:load for carousel hydration', () => {
            expect(content).toContain('client:load');
        });

        it('should enable parallax', () => {
            expect(content).toContain('enableParallax');
        });
    });

    describe('Dark gradient overlay', () => {
        it('should have dark overlay for text readability', () => {
            expect(content).toContain('bg-gradient-to-b');
            expect(content).toContain('from-black/60');
        });

        it('should have aria-hidden on overlay', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Content area', () => {
        it('should render headline as h1', () => {
            expect(content).toContain('<h1');
        });

        it('should use Fraunces font-variation-settings on h1', () => {
            expect(content).toContain('font-variation-settings');
        });

        it('should use custom display-hero font size token', () => {
            expect(content).toContain('--fs-display-hero');
        });

        it('should use font-accent for accentSubtitle', () => {
            expect(content).toContain('font-accent');
        });

        it('should apply -rotate-2 to accentSubtitle', () => {
            expect(content).toContain('-rotate-2');
        });

        it('should have larger subheadline text', () => {
            expect(content).toContain('text-lg');
            expect(content).toContain('sm:text-xl');
        });
    });

    describe('Live stats counter', () => {
        it('should import LiveStatsCounter', () => {
            expect(content).toContain('LiveStatsCounter');
        });

        it('should use client:visible for lazy hydration', () => {
            expect(content).toContain('client:visible');
        });

        it('should conditionally render counter', () => {
            expect(content).toContain('counterItems.length > 0');
        });
    });

    describe('Scroll indicator', () => {
        it('should have a scroll indicator element', () => {
            expect(content).toContain('hero-scroll-indicator');
        });

        it('should have CSS bounce animation', () => {
            expect(content).toContain('hero-bounce');
        });

        it('should be aria-hidden (decorative)', () => {
            expect(content).toContain('hero-scroll-indicator');
            // The scroll indicator div has aria-hidden="true"
            const scrollBlock = content.slice(content.indexOf('hero-scroll-indicator'));
            expect(scrollBlock).toContain('aria-hidden="true"');
        });
    });

    describe('Shape divider', () => {
        it('should have torn paper shape divider', () => {
            expect(content).toContain('hero-shape-divider');
        });

        it('should use CSS mask for shape', () => {
            expect(content).toContain('mask-image');
        });

        it('should use banner-shape.png', () => {
            expect(content).toContain('banner-shape.png');
        });
    });

    describe('HeroSearchBar integration', () => {
        it('should import HeroSearchBar', () => {
            expect(content).toContain('HeroSearchBar');
        });

        it('should pass locale to HeroSearchBar', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should pass apiBaseUrl to HeroSearchBar', () => {
            expect(content).toContain('apiBaseUrl={apiBaseUrl}');
        });

        it('should pass searchLabels as labels prop', () => {
            expect(content).toContain('labels={searchLabels}');
        });
    });

    describe('Text entrance animations', () => {
        it('should use hero-animate class for staggered entrance', () => {
            expect(content).toContain('hero-animate');
        });

        it('should have staggered delay classes', () => {
            expect(content).toContain('hero-animate-delay-1');
            expect(content).toContain('hero-animate-delay-2');
            expect(content).toContain('hero-animate-delay-3');
            expect(content).toContain('hero-animate-delay-4');
        });
    });

    describe('Accessibility', () => {
        it('should have empty alt text on decorative hero images', () => {
            expect(content).toContain('alt=""');
        });

        it('should have aria-hidden on decorative elements', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Code quality', () => {
        it('should not use any type', () => {
            expect(content).not.toContain(': any');
        });

        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });

        it('should have JSDoc comment block', () => {
            expect(content).toContain('/**');
        });
    });
});
