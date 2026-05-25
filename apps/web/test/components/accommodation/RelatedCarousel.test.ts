/**
 * @file RelatedCarousel.test.ts
 * @description SPEC-157 REQ-13 — heading hierarchy in related-content carousel.
 * The carousel section heading must use <h2> (not <h3>) because it sits at the
 * same structural level as other <h2> content sections on the detail page.
 * Using <h3> skips a heading level and violates WCAG 1.3.1.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/RelatedCarousel.astro'),
    'utf8'
);

describe('RelatedCarousel.astro (SPEC-157 REQ-13)', () => {
    describe('heading hierarchy', () => {
        it('should use <h2> for the section title (not <h3>)', () => {
            expect(src).toContain('<h2 class="related-carousel__title">');
        });

        it('should NOT use <h3> for the section title', () => {
            expect(src).not.toContain('<h3 class="related-carousel__title">');
        });
    });
});
