/**
 * Tests for HeroCarousel.client.tsx component.
 * Validates props interface, named export, accessibility, React hooks usage,
 * image loading strategy, reduced-motion support, and structural patterns.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/HeroCarousel.client.tsx');
const content = readFileSync(componentPath, 'utf8');

describe('HeroCarousel.client.tsx', () => {
    describe('Props interface', () => {
        it('should define HeroCarouselProps interface', () => {
            expect(content).toContain('HeroCarouselProps');
        });

        it('should accept slides prop', () => {
            expect(content).toContain('slides:');
        });

        it('should accept optional autoAdvanceMs prop', () => {
            expect(content).toContain('autoAdvanceMs?:');
        });

        it('should accept optional transitionMs prop', () => {
            expect(content).toContain('transitionMs?:');
        });

        it('should define HeroCarouselLabels interface', () => {
            expect(content).toContain('HeroCarouselLabels');
        });

        it('should accept labels prop for i18n strings', () => {
            expect(content).toContain('readonly labels: HeroCarouselLabels');
        });

        it('should define HeroCarouselSlide interface', () => {
            expect(content).toContain('HeroCarouselSlide');
        });

        it('should define src field in HeroCarouselSlide', () => {
            expect(content).toContain('readonly src: string');
        });

        it('should define alt field in HeroCarouselSlide', () => {
            expect(content).toContain('readonly alt: string');
        });
    });

    describe('Named export', () => {
        it('should export HeroCarousel as named export', () => {
            expect(content).toContain('export function HeroCarousel(');
        });

        it('should not use default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-live attribute for screen reader announcements', () => {
            expect(content).toContain('aria-live');
        });

        it('should use aria-live="polite"', () => {
            expect(content).toContain('aria-live="polite"');
        });

        it('should have aria-atomic attribute on live region', () => {
            expect(content).toContain('aria-atomic');
        });

        it('should use labels prop for carousel section aria-label', () => {
            expect(content).toContain('aria-label={labels.carouselAriaLabel}');
        });

        it('should use labels prop for live region text', () => {
            expect(content).toContain('labels.liveRegionText');
        });

        it('should use labels prop for slide nav legend', () => {
            expect(content).toContain('{labels.slideNavLegend}');
        });

        it('should have aria-pressed on dot buttons', () => {
            expect(content).toContain('aria-pressed');
        });

        it('should have aria-label on dot buttons via labels prop', () => {
            expect(content).toContain('labels.dotAriaLabel');
        });

        it('should have aria-hidden on inactive slides', () => {
            expect(content).toContain('aria-hidden');
        });
    });

    describe('React hooks', () => {
        it('should import useState', () => {
            expect(content).toContain('useState');
        });

        it('should import useEffect', () => {
            expect(content).toContain('useEffect');
        });

        it('should import useCallback', () => {
            expect(content).toContain('useCallback');
        });

        it('should import useRef', () => {
            expect(content).toContain('useRef');
        });

        it('should use useState for currentSlide', () => {
            expect(content).toContain('currentSlide');
            expect(content).toContain('setCurrentSlide');
        });

        it('should use useState for failedSlides', () => {
            expect(content).toContain('failedSlides');
            expect(content).toContain('setFailedSlides');
        });
    });

    describe('Image loading strategy', () => {
        it('should use loading="eager" for first slide', () => {
            expect(content).toContain("loading={index === 0 ? 'eager' : 'lazy'}");
        });

        it('should use fetchPriority for first slide', () => {
            expect(content).toContain('fetchPriority');
        });

        it('should set fetchPriority="high" for first slide', () => {
            expect(content).toContain("fetchPriority={index === 0 ? 'high' : undefined}");
        });

        it('should use loading="lazy" for subsequent slides', () => {
            expect(content).toContain("'lazy'");
        });
    });

    describe('Reduced-motion support', () => {
        it('should check for prefers-reduced-motion media query', () => {
            expect(content).toContain('prefers-reduced-motion');
        });

        it('should use window.matchMedia for reduced motion detection', () => {
            expect(content).toContain('window.matchMedia');
        });

        it('should use reduce keyword in media query', () => {
            expect(content).toContain('reduce');
        });

        it('should define useReducedMotion hook', () => {
            expect(content).toContain('useReducedMotion');
        });

        it('should disable transitions when reduced motion is preferred', () => {
            expect(content).toContain('prefersReducedMotion ? 0 : transitionMs');
        });
    });

    describe('Fallback gradient', () => {
        it('should render gradient fallback when slides is empty', () => {
            expect(content).toContain('bg-gradient-to-br from-primary to-primary-dark');
        });

        it('should have aria-hidden on fallback gradient div', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should check for empty slides array', () => {
            expect(content).toContain('slides.length === 0');
        });
    });

    describe('Dot indicator buttons', () => {
        it('should render dot buttons for slide navigation', () => {
            expect(content).toContain('<button');
        });

        it('should render dot indicators inside a fieldset', () => {
            expect(content).toContain('<fieldset');
        });

        it('should render dot indicators only when multiple slides exist', () => {
            expect(content).toContain('validIndices.length > 1');
        });

        it('should have type="button" on dot buttons', () => {
            expect(content).toContain('type="button"');
        });

        it('should handle dot click to navigate slides', () => {
            expect(content).toContain('handleDotClick');
        });

        it('should reset timer on dot click', () => {
            expect(content).toContain('reset()');
        });
    });

    describe('Mouse interaction pause logic', () => {
        it('should have onMouseEnter handler to pause carousel', () => {
            expect(content).toContain('onMouseEnter={pause}');
        });

        it('should have onMouseLeave handler to resume carousel', () => {
            expect(content).toContain('onMouseLeave={resume}');
        });

        it('should define pause function', () => {
            expect(content).toContain('pause');
        });

        it('should define resume function', () => {
            expect(content).toContain('resume');
        });
    });

    describe('Auto-advance timer', () => {
        it('should use setInterval for auto-advance', () => {
            expect(content).toContain('setInterval');
        });

        it('should use clearInterval for cleanup', () => {
            expect(content).toContain('clearInterval');
        });

        it('should define useCarouselTimer hook', () => {
            expect(content).toContain('useCarouselTimer');
        });

        it('should disable auto-advance when reduced motion is preferred', () => {
            expect(content).toContain('prefersReducedMotion');
            expect(content).toContain('autoEnabled');
        });
    });

    describe('Error handling for images', () => {
        it('should handle image load errors', () => {
            expect(content).toContain('onError');
        });

        it('should define handleImageError function', () => {
            expect(content).toContain('handleImageError');
        });

        it('should skip failed slides', () => {
            expect(content).toContain('failedSlides');
        });
    });

    describe('Focus management', () => {
        it('should handle focusin event to pause on focus', () => {
            expect(content).toContain('focusin');
        });

        it('should handle focusout event to resume on blur', () => {
            expect(content).toContain('focusout');
        });

        it('should use a ref for the carousel region', () => {
            expect(content).toContain('regionRef');
        });
    });

    describe('File size', () => {
        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });
    });
});
