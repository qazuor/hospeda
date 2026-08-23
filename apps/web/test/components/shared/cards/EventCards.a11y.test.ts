/**
 * @file EventCards.a11y.test.ts
 * @description SPEC-157 REQ-14 — alt text on event card featured images.
 * Featured images on event cards are meaningful content images (not decorative)
 * and must carry descriptive alt text derived from the event name prop.
 * Using alt="" on a meaningful image violates WCAG 1.1.1.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const featuredSrc = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/EventCardFeatured.astro'),
    'utf8'
);

const horizontalSrc = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/EventCardHorizontal.astro'),
    'utf8'
);

describe('EventCardFeatured.astro — featured image alt (SPEC-157 REQ-14)', () => {
    it('should use data.name as the alt text (not an empty string)', () => {
        // The featured image must bind alt to a meaningful prop, not leave it empty.
        expect(featuredSrc).toContain('alt={data.name}');
    });

    it('should NOT render an empty alt on either Image or img variants', () => {
        expect(featuredSrc).not.toContain('alt=""');
    });
});

describe('EventCardHorizontal.astro — featured image alt (SPEC-157 REQ-14)', () => {
    it('should use data.name as the alt text (not an empty string)', () => {
        expect(horizontalSrc).toContain('alt={data.name}');
    });

    it('should NOT render an empty alt on either Image or img variants', () => {
        expect(horizontalSrc).not.toContain('alt=""');
    });
});
