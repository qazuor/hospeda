import { describe, expect, it } from 'vitest';
import {
    calculateActiveIndex,
    resolveKeyboardNavigation
} from '../../../src/components/destination/destination-carousel.utils';

describe('destination-carousel.utils', () => {
    describe('calculateActiveIndex', () => {
        it('should return index 0 when scrolled to the start', () => {
            // Arrange
            const input = { scrollLeft: 0, itemWidth: 300, itemCount: 5 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 0 });
        });

        it('should return the correct index when scrolled to an exact item boundary', () => {
            // Arrange
            const input = { scrollLeft: 600, itemWidth: 300, itemCount: 5 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 2 });
        });

        it('should round to the nearest item when between two boundaries', () => {
            // Arrange - 160 is past the midpoint of 300, so rounds to index 1
            const input = { scrollLeft: 160, itemWidth: 300, itemCount: 5 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 1 });
        });

        it('should round down when before the midpoint', () => {
            // Arrange - 140 is before the midpoint of 300, so rounds to index 0
            const input = { scrollLeft: 140, itemWidth: 300, itemCount: 5 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 0 });
        });

        it('should clamp to the last item when scroll exceeds total width', () => {
            // Arrange
            const input = { scrollLeft: 5000, itemWidth: 300, itemCount: 3 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 2 });
        });

        it('should clamp to 0 when scrollLeft is negative', () => {
            // Arrange
            const input = { scrollLeft: -100, itemWidth: 300, itemCount: 5 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 0 });
        });

        it('should return 0 when itemCount is 0', () => {
            // Arrange
            const input = { scrollLeft: 100, itemWidth: 300, itemCount: 0 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 0 });
        });

        it('should return 0 when itemWidth is 0', () => {
            // Arrange
            const input = { scrollLeft: 100, itemWidth: 0, itemCount: 5 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 0 });
        });

        it('should return 0 for a single-item carousel', () => {
            // Arrange
            const input = { scrollLeft: 0, itemWidth: 300, itemCount: 1 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 0 });
        });

        it('should handle fractional scroll positions', () => {
            // Arrange - 299.7 / 300 rounds to 1
            const input = { scrollLeft: 299.7, itemWidth: 300, itemCount: 5 };

            // Act
            const result = calculateActiveIndex(input);

            // Assert
            expect(result).toEqual({ activeIndex: 1 });
        });
    });

    describe('resolveKeyboardNavigation', () => {
        it('should return next index for ArrowRight', () => {
            // Arrange
            const input = { key: 'ArrowRight', currentIndex: 1, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: 2 });
        });

        it('should return next index for ArrowDown', () => {
            // Arrange
            const input = { key: 'ArrowDown', currentIndex: 0, itemCount: 3 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: 1 });
        });

        it('should clamp ArrowRight at the last item', () => {
            // Arrange
            const input = { key: 'ArrowRight', currentIndex: 4, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: 4 });
        });

        it('should return previous index for ArrowLeft', () => {
            // Arrange
            const input = { key: 'ArrowLeft', currentIndex: 3, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: 2 });
        });

        it('should return previous index for ArrowUp', () => {
            // Arrange
            const input = { key: 'ArrowUp', currentIndex: 2, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: 1 });
        });

        it('should clamp ArrowLeft at the first item', () => {
            // Arrange
            const input = { key: 'ArrowLeft', currentIndex: 0, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: 0 });
        });

        it('should return 0 for Home key', () => {
            // Arrange
            const input = { key: 'Home', currentIndex: 3, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: 0 });
        });

        it('should return last index for End key', () => {
            // Arrange
            const input = { key: 'End', currentIndex: 1, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: 4 });
        });

        it('should return null for unhandled keys', () => {
            // Arrange
            const input = { key: 'Tab', currentIndex: 1, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: null });
        });

        it('should return null for Enter key', () => {
            // Arrange
            const input = { key: 'Enter', currentIndex: 2, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: null });
        });

        it('should return null when itemCount is 0', () => {
            // Arrange
            const input = { key: 'ArrowRight', currentIndex: 0, itemCount: 0 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: null });
        });

        it('should return null for Space key', () => {
            // Arrange
            const input = { key: ' ', currentIndex: 0, itemCount: 5 };

            // Act
            const result = resolveKeyboardNavigation(input);

            // Assert
            expect(result).toEqual({ targetIndex: null });
        });
    });
});
