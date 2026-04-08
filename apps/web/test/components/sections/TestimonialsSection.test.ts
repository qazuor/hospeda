/**
 * @file TestimonialsSection.test.ts
 * @description Unit tests for TestimonialsSection.astro component.
 * Follows Astro testing pattern: read source file and assert on content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/sections/TestimonialsSection.astro'),
    'utf8'
);

describe('TestimonialsSection.astro', () => {
    describe('star rating aria-label', () => {
        it('should NOT use broken .replace() pattern for aria-label', () => {
            expect(src).not.toContain('.replace(');
        });

        it('should interpolate rating value directly in aria-label', () => {
            expect(src).toContain('review.rating');
            expect(src).toContain('starsAriaLabelSuffix');
        });

        it('should build aria-label with template literal using review.rating', () => {
            expect(src).toContain('`${review.rating}');
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

        it('should render testimonial cards', () => {
            expect(src).toContain('testimonial-card');
        });
    });

    describe('rating display', () => {
        it('should render star characters for filled stars', () => {
            expect(src).toContain('★');
        });

        it('should render empty star characters', () => {
            expect(src).toContain('☆');
        });

        it('should use parseStars function', () => {
            expect(src).toContain('parseStars');
        });
    });
});
