/**
 * @file VenueReviewsPreview.test.ts
 * @description Source-read guards for the per-dimension averages block
 * (HOS-1866 / 6.6, TEST:6.6:3). `.astro` components cannot be rendered by this
 * app's Vitest, and the decisions live in `resolveDimensionAverages` (covered
 * in `test/lib/venue/review-dimensions-view.test.ts`). These assertions prove
 * the component consumes that list, hides the block when it is empty, and does
 * not hardcode dimension ids, labels, types or business lines.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenueReviewsPreview.astro'),
    'utf8'
);

describe('VenueReviewsPreview.astro — dimension averages (AC:6:10)', () => {
    it('consumes the dimensionRatings prop', () => {
        expect(src).toContain('dimensionRatings: readonly ResolvedDimensionAverage[]');
        expect(src).toContain('dimensionRatings.map((dimension) =>');
    });

    it('renders nothing for the block when the list is empty', () => {
        expect(src).toContain('dimensionRatings.length > 0 &&');
    });

    it('uses the label key and vote count the helper resolved', () => {
        expect(src).toContain('t(dimension.labelKey)');
        expect(src).toContain("tPlural('review.dimensionAverages.votes', dimension.count)");
    });

    it('never hardcodes a dimension id, label key, type or business line', () => {
        expect(src).not.toMatch(/[=!]==?\s*['"](food|service|ambiance|value)['"]/);
        expect(src).not.toContain('review.dimensions.food');
        expect(src).not.toContain("'BOLICHE'");
        expect(src).not.toContain("'RESTAURANT'");
        expect(src).not.toContain('.businessLines');
    });

    it('keeps the existing no-reviews gate', () => {
        expect(src).toContain('if (reviewsCount <= 0) return;');
    });

    it('styles the block with design tokens, not Tailwind', () => {
        expect(src).toContain('var(--core-card)');
        expect(src).toContain('var(--core-muted-foreground)');
        expect(src).toContain('var(--rating-star)');
        expect(src).not.toMatch(/class="[^"]*\b(bg-|text-|p-|m-|flex-|grid-)\w/);
    });
});
