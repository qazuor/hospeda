/**
 * @file home-rating-guard.test.ts
 * @description Unit tests for the homepage hero social-proof guard. The guard
 * lives in `apps/web/src/lib/home-guards.ts` and is consumed by
 * `apps/web/src/pages/[lang]/index.astro`. The block must be hidden when the
 * average rating is missing, zero, NaN or otherwise non-finite — even if the
 * review count is positive — so we never leak placeholder values like "0/5"
 * or "NaN/5" into the UI.
 */

import { describe, expect, it } from 'vitest';
import { shouldShowSocialProof } from '../../src/lib/home-guards';

describe('shouldShowSocialProof', () => {
    it('hides the block when there are zero reviews even if rating is positive', () => {
        // Arrange
        const input = { reviewsCount: 0, averageRating: 4.5 };
        // Act
        const result = shouldShowSocialProof(input);
        // Assert
        expect(result).toBe(false);
    });

    it('hides the block when reviews exist but average rating is exactly zero', () => {
        // Arrange
        const input = { reviewsCount: 5, averageRating: 0 };
        // Act
        const result = shouldShowSocialProof(input);
        // Assert
        expect(result).toBe(false);
    });

    it('hides the block when average rating is NaN (e.g. division by zero upstream)', () => {
        // Arrange
        const input = { reviewsCount: 5, averageRating: Number.NaN };
        // Act
        const result = shouldShowSocialProof(input);
        // Assert
        expect(result).toBe(false);
    });

    it('hides the block when average rating is Infinity', () => {
        // Arrange
        const input = { reviewsCount: 5, averageRating: Number.POSITIVE_INFINITY };
        // Act
        const result = shouldShowSocialProof(input);
        // Assert
        expect(result).toBe(false);
    });

    it('hides the block when average rating is undefined', () => {
        // Arrange
        const input = { reviewsCount: 5, averageRating: undefined };
        // Act
        const result = shouldShowSocialProof(input);
        // Assert
        expect(result).toBe(false);
    });

    it('shows the block when both reviews and a finite positive rating exist', () => {
        // Arrange
        const input = { reviewsCount: 5, averageRating: 4.2 };
        // Act
        const result = shouldShowSocialProof(input);
        // Assert
        expect(result).toBe(true);
    });

    it('hides the block when review count is negative (defensive)', () => {
        // Arrange
        const input = { reviewsCount: -1, averageRating: 4.5 };
        // Act
        const result = shouldShowSocialProof(input);
        // Assert
        expect(result).toBe(false);
    });
});
