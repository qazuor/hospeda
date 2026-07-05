/**
 * @file computeBestValue.test.ts
 * @description Unit tests for the pure best-value comparison helper (HOS-85 T-003).
 *
 * Coverage:
 * - Cheapest price wins.
 * - Highest average rating wins.
 * - Ties produce all winners for that metric.
 * - Missing price/rating values are excluded from contention.
 * - Single-item and empty input yield no winners.
 * - A realistic multi-item case with different best-price vs best-rating holders.
 */

import { describe, expect, it } from 'vitest';
import {
    type BestValueItem,
    computeBestValue
} from '../../../../src/components/shared/compare/computeBestValue';

describe('computeBestValue', () => {
    describe('when given valid multi-item input', () => {
        it('should return the id of the cheapest item as bestPriceIds', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 1500 }, averageRating: 4 },
                { id: 'b', price: { amount: 900 }, averageRating: 4 },
                { id: 'c', price: { amount: 1200 }, averageRating: 4 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestPriceIds).toEqual(['b']);
        });

        it('should return the id of the highest-rated item as bestRatingIds', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 1000 }, averageRating: 3.2 },
                { id: 'b', price: { amount: 1000 }, averageRating: 4.9 },
                { id: 'c', price: { amount: 1000 }, averageRating: 4.1 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestRatingIds).toEqual(['b']);
        });

        it('should return all tied ids when multiple items share the cheapest price', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 800 }, averageRating: 4 },
                { id: 'b', price: { amount: 800 }, averageRating: 4 },
                { id: 'c', price: { amount: 1200 }, averageRating: 4 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestPriceIds.slice().sort()).toEqual(['a', 'b']);
        });

        it('should return all tied ids when multiple items share the highest rating', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 800 }, averageRating: 4.8 },
                { id: 'b', price: { amount: 900 }, averageRating: 4.8 },
                { id: 'c', price: { amount: 1000 }, averageRating: 3.5 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestRatingIds.slice().sort()).toEqual(['a', 'b']);
        });

        it('should exclude items with a missing price from bestPriceIds contention', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', averageRating: 4 },
                { id: 'b', price: { amount: 500 }, averageRating: 4 },
                { id: 'c', price: { amount: 1500 }, averageRating: 4 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestPriceIds).toEqual(['b']);
        });

        it('should exclude items with a missing (undefined) rating from bestRatingIds contention', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 1000 } },
                { id: 'b', price: { amount: 1000 }, averageRating: 4.2 },
                { id: 'c', price: { amount: 1000 }, averageRating: 3.1 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestRatingIds).toEqual(['b']);
        });

        it('should treat a null rating the same as a missing rating', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 1000 }, averageRating: null },
                { id: 'b', price: { amount: 1000 }, averageRating: 4.2 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestRatingIds).toEqual(['b']);
        });

        it('should treat an averageRating of 0 as "no rating" (matches the matrix display convention)', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 1000 }, averageRating: 0 },
                { id: 'b', price: { amount: 1000 }, averageRating: 3.5 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestRatingIds).toEqual(['b']);
        });

        it('should return no rating winners when every item lacks a usable rating', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 1000 }, averageRating: 0 },
                { id: 'b', price: { amount: 800 } }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestRatingIds).toEqual([]);
            expect(result.bestPriceIds).toEqual(['b']);
        });

        it('should hold different winners for price and rating in a realistic multi-item case', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'budget-hostel', price: { amount: 500000 }, averageRating: 3.4 },
                { id: 'boutique-hotel', price: { amount: 2200000 }, averageRating: 4.9 },
                { id: 'mid-range-cabin', price: { amount: 1200000 }, averageRating: 4.1 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result.bestPriceIds).toEqual(['budget-hostel']);
            expect(result.bestRatingIds).toEqual(['boutique-hotel']);
        });
    });

    describe('when given edge-case input', () => {
        it('should return no winners for a single-item input', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'only', price: { amount: 1000 }, averageRating: 4.5 }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result).toEqual({ bestPriceIds: [], bestRatingIds: [] });
        });

        it('should return no winners for empty input', () => {
            // Arrange
            const items: readonly BestValueItem[] = [];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result).toEqual({ bestPriceIds: [], bestRatingIds: [] });
        });

        it('should return no winners for either metric when no item has a usable value', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', averageRating: 0 },
                { id: 'b', averageRating: null }
            ];

            // Act
            const result = computeBestValue({ items });

            // Assert
            expect(result).toEqual({ bestPriceIds: [], bestRatingIds: [] });
        });

        it('should not mutate the input items array', () => {
            // Arrange
            const items: readonly BestValueItem[] = [
                { id: 'a', price: { amount: 1000 }, averageRating: 4 },
                { id: 'b', price: { amount: 500 }, averageRating: 4.5 }
            ];
            const snapshot = JSON.parse(JSON.stringify(items));

            // Act
            computeBestValue({ items });

            // Assert
            expect(items).toEqual(snapshot);
        });
    });
});
