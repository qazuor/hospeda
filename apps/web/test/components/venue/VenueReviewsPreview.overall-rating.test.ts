/**
 * @file VenueReviewsPreview.overall-rating.test.ts
 * @description HOS-2082 source-read guard (`.astro` cannot be rendered by this
 * app's Vitest): each review card must resolve its star through
 * `resolveReviewCardRating`, never read `review.averageRating` directly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenueReviewsPreview.astro'),
    'utf8'
);

describe('VenueReviewsPreview.astro review card rating (HOS-2082)', () => {
    it('resolves the card rating through the shared helper', () => {
        expect(src).toContain('resolveReviewCardRating(review)');
    });

    it('does not render review.averageRating directly', () => {
        expect(src).not.toMatch(/review\.averageRating/);
    });
});
