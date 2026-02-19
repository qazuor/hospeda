/**
 * Tests for TestimonialsSection.astro and TestimonialCarousel.client.tsx.
 * Validates structure, SectionWrapper usage, empty guard, carousel ARIA.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sectionPath = resolve(__dirname, '../../../src/components/content/TestimonialsSection.astro');
const sectionContent = readFileSync(sectionPath, 'utf8');

const carouselPath = resolve(
    __dirname,
    '../../../src/components/content/TestimonialCarousel.client.tsx'
);
const carouselContent = readFileSync(carouselPath, 'utf8');

describe('TestimonialsSection.astro', () => {
    describe('Props', () => {
        it('should accept optional locale prop', () => {
            expect(sectionContent).toContain('locale');
        });

        it('should accept optional testimonials array', () => {
            expect(sectionContent).toContain('testimonials');
        });

        it('should accept optional autoAdvanceMs', () => {
            expect(sectionContent).toContain('autoAdvanceMs');
        });

        it('should define TestimonialItem type', () => {
            expect(sectionContent).toContain('TestimonialItem');
        });
    });

    describe('SectionWrapper usage', () => {
        it('should import SectionWrapper', () => {
            expect(sectionContent).toContain('SectionWrapper');
        });

        it('should use warm variant for beige background', () => {
            expect(sectionContent).toContain('variant="warm"');
        });
    });

    describe('SectionHeader usage', () => {
        it('should import SectionHeader', () => {
            expect(sectionContent).toContain('SectionHeader');
        });
    });

    describe('i18n integration', () => {
        it('should import t function from lib/i18n', () => {
            expect(sectionContent).toContain("from '../../lib/i18n'");
        });

        it('should use t() for section header title', () => {
            expect(sectionContent).toContain("'testimonials.title'");
        });

        it('should use t() for accent subtitle', () => {
            expect(sectionContent).toContain("'testimonials.accentSubtitle'");
        });
    });

    describe('Empty guard', () => {
        it('should not render section when testimonials is empty', () => {
            expect(sectionContent).toContain('testimonials');
            expect(sectionContent).toContain('length');
        });
    });

    describe('TestimonialCarousel integration', () => {
        it('should import TestimonialCarousel', () => {
            expect(sectionContent).toContain('TestimonialCarousel');
        });

        it('should use client:visible directive', () => {
            expect(sectionContent).toContain('client:visible');
        });
    });
});

describe('TestimonialCarousel.client.tsx', () => {
    describe('Exports', () => {
        it('should use named export', () => {
            expect(carouselContent).toContain('export const TestimonialCarousel');
        });

        it('should NOT have default export', () => {
            expect(carouselContent).not.toContain('export default');
        });
    });

    describe('Props', () => {
        it('should accept testimonials array', () => {
            expect(carouselContent).toContain('testimonials');
        });

        it('should accept optional autoAdvanceMs', () => {
            expect(carouselContent).toContain('autoAdvanceMs');
        });
    });

    describe('i18n integration', () => {
        it('should import useTranslation hook', () => {
            expect(carouselContent).toContain('useTranslation');
        });

        it('should use home namespace for translations', () => {
            expect(carouselContent).toContain("namespace: 'home'");
        });

        it('should use t() for ARIA labels instead of hardcoded strings', () => {
            expect(carouselContent).toContain("t('testimonials.");
        });
    });

    describe('ARIA', () => {
        it('should have role=region on carousel container', () => {
            expect(carouselContent).toContain('role="region"');
        });

        it('should have aria-label on carousel', () => {
            expect(carouselContent).toContain('aria-label');
        });

        it('should have aria-live=off to prevent screen reader interruptions', () => {
            expect(carouselContent).toContain('aria-live="off"');
        });
    });

    describe('Auto-advance', () => {
        it('should use setInterval for auto-advance', () => {
            expect(carouselContent).toContain('setInterval');
        });

        it('should support pause on hover', () => {
            expect(carouselContent).toContain('onMouseEnter');
            expect(carouselContent).toContain('onMouseLeave');
        });
    });

    describe('Navigation', () => {
        it('should track current index state', () => {
            expect(carouselContent).toContain('currentIndex');
        });

        it('should loop from last to first', () => {
            // Should have modulo logic for looping
            expect(carouselContent).toContain('% testimonials.length');
        });
    });

    describe('Touch support', () => {
        it('should handle touch events for mobile swipe', () => {
            expect(carouselContent).toContain('onTouchStart');
            expect(carouselContent).toContain('onTouchEnd');
        });
    });

    describe('Dots navigation', () => {
        it('should render dot indicators', () => {
            expect(carouselContent).toContain('map');
            // Dots change based on currentIndex
            expect(carouselContent).toContain('currentIndex');
        });

        it('should highlight active dot with primary color', () => {
            expect(carouselContent).toContain('bg-primary');
        });

        it('should use gray for inactive dots', () => {
            expect(carouselContent).toContain('bg-gray-300');
        });
    });

    describe('Card inner structure', () => {
        it('should render blockquote for testimonial text', () => {
            expect(carouselContent).toContain('<blockquote');
        });

        it('should render avatar image conditionally', () => {
            expect(carouselContent).toContain('<img');
            expect(carouselContent).toContain('avatar');
        });

        it('should render star rating with filled and empty stars', () => {
            expect(carouselContent).toContain('\\u2605');
            expect(carouselContent).toContain('\\u2606');
        });

        it('should use amber-400 for star colors', () => {
            expect(carouselContent).toContain('text-amber-400');
        });

        it('should display location when provided', () => {
            expect(carouselContent).toContain('testimonial.location');
        });

        it('should use surface background and border for cards', () => {
            expect(carouselContent).toContain('bg-surface');
            expect(carouselContent).toContain('border-border');
        });
    });

    describe('Empty state', () => {
        it('should return null when testimonials array is empty', () => {
            expect(carouselContent).toContain('return null');
        });
    });
});
