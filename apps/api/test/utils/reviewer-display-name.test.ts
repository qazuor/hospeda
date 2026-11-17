/**
 * HOS-2330 D-8 — `resolveReviewerDisplayName`: the one rule that names a review's
 * author, shared by the public accommodation reviews route and `list_reviews`.
 *
 * @module test/utils/reviewer-display-name
 */

import { describe, expect, it } from 'vitest';
import { resolveReviewerDisplayName } from '../../src/utils/reviewer-display-name';

describe('resolveReviewerDisplayName', () => {
    it('prefers the display name the user chose', () => {
        // Arrange
        const reviewer = { displayName: 'Anita', firstName: 'Ana', lastName: 'Pérez' };

        // Act / Assert
        expect(resolveReviewerDisplayName({ reviewer })).toBe('Anita');
    });

    it('falls back to the first name and the last name initial', () => {
        expect(
            resolveReviewerDisplayName({ reviewer: { firstName: 'Ana', lastName: 'Pérez' } })
        ).toBe('Ana P.');
    });

    it('falls back to the first name alone', () => {
        expect(resolveReviewerDisplayName({ reviewer: { firstName: 'Ana' } })).toBe('Ana');
    });

    it('returns null when the user has no name at all', () => {
        expect(resolveReviewerDisplayName({ reviewer: {} })).toBeNull();
        expect(
            resolveReviewerDisplayName({
                reviewer: { displayName: null, firstName: null, lastName: 'Pérez' }
            })
        ).toBeNull();
    });
});
