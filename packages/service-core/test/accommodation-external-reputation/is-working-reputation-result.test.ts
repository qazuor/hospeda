/**
 * Unit tests for `isWorkingReputationResult` — the shared "should the section
 * auto-enable?" predicate used by the inline refresh and the Apify poll cron.
 */

import { describe, expect, it } from 'vitest';
import { isWorkingReputationResult } from '../../src/services/accommodation-external-reputation/is-working-reputation-result.js';

const VISIBLE_LISTING = {
    deletedAt: null,
    showLink: true,
    showReviews: false
} as const;

describe('isWorkingReputationResult', () => {
    it('returns true for an ok fetch with a rating on a visible listing', () => {
        expect(
            isWorkingReputationResult({
                fetchStatus: 'ok',
                rating: 4.7,
                snippets: null,
                listing: VISIBLE_LISTING
            })
        ).toBe(true);
    });

    it('returns true for an ok fetch with snippets even when the rating is null', () => {
        expect(
            isWorkingReputationResult({
                fetchStatus: 'ok',
                rating: null,
                snippets: [{ author: 'Ana', text: 'Great!' }],
                listing: VISIBLE_LISTING
            })
        ).toBe(true);
    });

    it('returns true when only showReviews makes the listing visible', () => {
        expect(
            isWorkingReputationResult({
                fetchStatus: 'ok',
                rating: 4.2,
                snippets: null,
                listing: { deletedAt: null, showLink: false, showReviews: true }
            })
        ).toBe(true);
    });

    it('returns false when the fetch status is not ok', () => {
        expect(
            isWorkingReputationResult({
                fetchStatus: 'error',
                rating: 4.7,
                snippets: null,
                listing: VISIBLE_LISTING
            })
        ).toBe(false);
    });

    it('returns false for an ok fetch with no displayable data', () => {
        expect(
            isWorkingReputationResult({
                fetchStatus: 'ok',
                rating: null,
                snippets: [],
                listing: VISIBLE_LISTING
            })
        ).toBe(false);
    });

    it('returns false for a soft-deleted listing', () => {
        expect(
            isWorkingReputationResult({
                fetchStatus: 'ok',
                rating: 4.7,
                snippets: null,
                listing: { deletedAt: new Date(), showLink: true, showReviews: true }
            })
        ).toBe(false);
    });

    it('returns false when the listing is hidden from guests', () => {
        expect(
            isWorkingReputationResult({
                fetchStatus: 'ok',
                rating: 4.7,
                snippets: null,
                listing: { deletedAt: null, showLink: false, showReviews: false }
            })
        ).toBe(false);
    });
});
