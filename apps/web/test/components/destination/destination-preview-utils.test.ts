import { describe, expect, it } from 'vitest';
import { calculatePreviewPosition } from '../../../src/components/destination/destination-preview.utils';

describe('destination-preview.utils', () => {
    describe('calculatePreviewPosition', () => {
        const defaultViewport = { viewportWidth: 1280, viewportHeight: 800 };
        const defaultPreview = { previewWidth: 288, previewHeight: 320 };

        it('should position below the card when there is enough space', () => {
            // Arrange
            const input = {
                triggerRect: { top: 100, bottom: 200, left: 300 },
                ...defaultPreview,
                ...defaultViewport
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            expect(result.top).toBe(208); // bottom(200) + gap(8)
            expect(result.left).toBe(300);
        });

        it('should position above the card when bottom would overflow', () => {
            // Arrange - card near the bottom of viewport
            const input = {
                triggerRect: { top: 600, bottom: 700, left: 300 },
                ...defaultPreview,
                ...defaultViewport
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            // top = 600 - 320 - 8 = 272
            expect(result.top).toBe(272);
            expect(result.left).toBe(300);
        });

        it('should clamp top to minimum 8px edge padding', () => {
            // Arrange - card near top, preview too tall to fit above or below
            const input = {
                triggerRect: { top: 10, bottom: 50, left: 100 },
                previewWidth: 288,
                previewHeight: 600,
                viewportWidth: 1280,
                viewportHeight: 400
            };
            // Below: 50 + 8 = 58, 58 + 600 = 658 > 400, overflow
            // Above: 10 - 600 - 8 = -598, clamped to 8

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            expect(result.top).toBe(8);
        });

        it('should clamp left when preview would overflow right edge', () => {
            // Arrange - card near right edge
            const input = {
                triggerRect: { top: 100, bottom: 200, left: 1100 },
                ...defaultPreview,
                ...defaultViewport
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            // left = 1280 - 288 - 16 = 976
            expect(result.left).toBe(976);
        });

        it('should not clamp left when there is enough horizontal space', () => {
            // Arrange
            const input = {
                triggerRect: { top: 100, bottom: 200, left: 50 },
                ...defaultPreview,
                ...defaultViewport
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            expect(result.left).toBe(50);
        });

        it('should handle card at the very top of viewport', () => {
            // Arrange
            const input = {
                triggerRect: { top: 0, bottom: 60, left: 200 },
                ...defaultPreview,
                ...defaultViewport
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            // bottom(60) + gap(8) = 68, has room below
            expect(result.top).toBe(68);
        });

        it('should handle card at bottom-right corner', () => {
            // Arrange
            const input = {
                triggerRect: { top: 700, bottom: 780, left: 1200 },
                ...defaultPreview,
                ...defaultViewport
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            // Tries below: 788, overflows (788+320 > 800), so above: 700-320-8 = 372
            expect(result.top).toBe(372);
            // Left clamped: 1280 - 288 - 16 = 976
            expect(result.left).toBe(976);
        });

        it('should handle very small viewport', () => {
            // Arrange
            const input = {
                triggerRect: { top: 50, bottom: 100, left: 10 },
                previewWidth: 288,
                previewHeight: 320,
                viewportWidth: 400,
                viewportHeight: 300
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            // Below: 108, overflows (108+320>300), above: 50-320-8 = -278, clamped to 8
            expect(result.top).toBe(8);
            // Left: 10+288 = 298 < 400, fits fine
            expect(result.left).toBe(10);
        });

        it('should handle preview exactly fitting below the card', () => {
            // Arrange - exactly fits: bottom(200) + gap(8) + height(320) = 528 <= 528
            const input = {
                triggerRect: { top: 100, bottom: 200, left: 100 },
                previewWidth: 288,
                previewHeight: 320,
                viewportWidth: 1280,
                viewportHeight: 528
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            expect(result.top).toBe(208);
        });

        it('should position above when preview overflows by 1px', () => {
            // Arrange - overflows by 1px: bottom(200) + gap(8) + height(320) = 528 > 527
            const input = {
                triggerRect: { top: 100, bottom: 200, left: 100 },
                previewWidth: 288,
                previewHeight: 320,
                viewportWidth: 1280,
                viewportHeight: 527
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            // above: 100 - 320 - 8 = -228, clamped to 8
            expect(result.top).toBe(8);
        });

        it('should handle zero-width preview', () => {
            // Arrange
            const input = {
                triggerRect: { top: 100, bottom: 200, left: 500 },
                previewWidth: 0,
                previewHeight: 100,
                ...defaultViewport
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            expect(result.left).toBe(500);
            expect(result.top).toBe(208);
        });

        it('should handle card left at 0', () => {
            // Arrange
            const input = {
                triggerRect: { top: 100, bottom: 200, left: 0 },
                ...defaultPreview,
                ...defaultViewport
            };

            // Act
            const result = calculatePreviewPosition(input);

            // Assert
            expect(result.left).toBe(0);
        });
    });
});
