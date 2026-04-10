/**
 * @file TestimonialsSection.test.ts
 * @description Unit tests for TestimonialsSection.astro component.
 * Updated after SPEC-048: star ratings are now delegated to TestimonialsCarousel island.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/sections/TestimonialsSection.astro'),
    'utf8'
);

describe('TestimonialsSection.astro', () => {
    describe('carousel delegation', () => {
        it('should NOT render star ratings inline (delegated to carousel island)', () => {
            expect(src).not.toContain('parseStars');
            expect(src).not.toContain('★');
            expect(src).not.toContain('☆');
        });

        it('should import and render TestimonialsCarousel island', () => {
            expect(src).toContain('TestimonialsCarousel');
            expect(src).toContain('client:visible');
        });

        it('should pass optimized reviews and locale props to the carousel', () => {
            expect(src).toContain('reviews={optimizedReviews}');
            expect(src).toContain('locale={locale}');
        });
    });

    describe('structure', () => {
        it('should render a section element', () => {
            expect(src).toContain('<section');
        });

        it('should have an aria-label on the section', () => {
            expect(src).toContain('aria-label=');
        });

        it('should use SectionHeader component', () => {
            expect(src).toContain('SectionHeader');
        });

        it('should apply testimonials-section BEM class', () => {
            expect(src).toContain('testimonials-section');
        });
    });

    describe('API integration', () => {
        it('should import testimonialsApi', () => {
            expect(src).toContain('testimonialsApi');
        });

        it('should guard rendering when reviews array is empty', () => {
            expect(src).toContain('reviews.length > 0');
        });
    });
});
