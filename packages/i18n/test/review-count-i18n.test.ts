/**
 * Regression guard for the review-count header shared by commerce listing
 * detail pages (gastronomy + experience).
 *
 * `GastronomyDetailHeader.astro` and `ExperienceHero.astro` render the review
 * count via `tPlural('review.list.totalReviews', count, { count })`. A SPEC-259
 * smoke found both components referencing the wrong path `review.totalReviews`
 * (no `.list`, no `{ count }`), which rendered the literal
 * `[MISSING: review.totalReviews]` on every public ficha.
 *
 * This suite locks the canonical key path, its plural shape, and the
 * `{{count}}` placeholder across all supported locales so the path cannot drift
 * back or the placeholder be dropped without a failing test.
 */

import { describe, expect, it } from 'vitest';
import reviewEn from '../src/locales/en/review.json';
import reviewEs from '../src/locales/es/review.json';
import reviewPt from '../src/locales/pt/review.json';

type ReviewLocale = {
    readonly list?: {
        readonly totalReviews_one?: unknown;
        readonly totalReviews_other?: unknown;
    };
    readonly totalReviews?: unknown;
};

const LOCALES: ReadonlyArray<readonly [string, ReviewLocale]> = [
    ['es', reviewEs as ReviewLocale],
    ['en', reviewEn as ReviewLocale],
    ['pt', reviewPt as ReviewLocale]
];

describe('review count header i18n (gastronomy + experience detail)', () => {
    for (const [name, locale] of LOCALES) {
        describe(`${name} locale`, () => {
            it('exposes review.list.totalReviews plural forms with a {{count}} placeholder', () => {
                const list = locale.list;
                expect(list).toBeDefined();
                expect(typeof list?.totalReviews_one).toBe('string');
                expect(typeof list?.totalReviews_other).toBe('string');
                expect(list?.totalReviews_one as string).toContain('{{count}}');
                expect(list?.totalReviews_other as string).toContain('{{count}}');
            });

            it('does NOT define a top-level review.totalReviews (the wrong path that rendered [MISSING])', () => {
                expect(locale.totalReviews).toBeUndefined();
            });
        });
    }
});
