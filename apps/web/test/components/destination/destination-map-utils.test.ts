import { describe, expect, it } from 'vitest';
import {
    DEFAULT_BOUNDS,
    DEFAULT_SVG_HEIGHT,
    DEFAULT_SVG_WIDTH,
    computeTooltipPosition,
    geoToSvg,
    truncateName
} from '../../../src/components/destination/destination-map.utils';

describe('destination-map.utils', () => {
    describe('geoToSvg', () => {
        const defaultInput = {
            bounds: DEFAULT_BOUNDS,
            svgWidth: DEFAULT_SVG_WIDTH,
            svgHeight: DEFAULT_SVG_HEIGHT
        };

        it('should convert coordinates at the center of the bounds', () => {
            // Arrange
            const midLat = (DEFAULT_BOUNDS.latMin + DEFAULT_BOUNDS.latMax) / 2;
            const midLon = (DEFAULT_BOUNDS.lonMin + DEFAULT_BOUNDS.lonMax) / 2;

            // Act
            const result = geoToSvg({
                lat: String(midLat),
                lon: String(midLon),
                ...defaultInput
            });

            // Assert
            expect(result).not.toBeNull();
            expect(result!.x).toBeCloseTo(DEFAULT_SVG_WIDTH / 2, 0);
            expect(result!.y).toBeCloseTo(DEFAULT_SVG_HEIGHT / 2, 0);
        });

        it('should place the top-left corner at the margin offset', () => {
            // Arrange - latMax (north) + lonMin (west) = top-left
            const lat = String(DEFAULT_BOUNDS.latMax);
            const lon = String(DEFAULT_BOUNDS.lonMin);

            // Act
            const result = geoToSvg({ lat, lon, ...defaultInput });

            // Assert
            expect(result).not.toBeNull();
            expect(result!.x).toBeCloseTo(20, 0);
            expect(result!.y).toBeCloseTo(20, 0);
        });

        it('should place the bottom-right corner at svgDimension minus margin', () => {
            // Arrange - latMin (south) + lonMax (east) = bottom-right
            const lat = String(DEFAULT_BOUNDS.latMin);
            const lon = String(DEFAULT_BOUNDS.lonMax);

            // Act
            const result = geoToSvg({ lat, lon, ...defaultInput });

            // Assert
            expect(result).not.toBeNull();
            expect(result!.x).toBeCloseTo(DEFAULT_SVG_WIDTH - 20, 0);
            expect(result!.y).toBeCloseTo(DEFAULT_SVG_HEIGHT - 20, 0);
        });

        it('should clamp latitude exceeding the northern bound', () => {
            // Arrange - lat is above latMax
            const result = geoToSvg({
                lat: '-25.0',
                lon: String(DEFAULT_BOUNDS.lonMin),
                ...defaultInput
            });

            // Assert - should be clamped to top edge (y = 20)
            expect(result).not.toBeNull();
            expect(result!.y).toBeCloseTo(20, 0);
        });

        it('should clamp latitude exceeding the southern bound', () => {
            // Arrange - lat is below latMin
            const result = geoToSvg({
                lat: '-40.0',
                lon: String(DEFAULT_BOUNDS.lonMin),
                ...defaultInput
            });

            // Assert - should be clamped to bottom edge
            expect(result).not.toBeNull();
            expect(result!.y).toBeCloseTo(DEFAULT_SVG_HEIGHT - 20, 0);
        });

        it('should clamp longitude exceeding the eastern bound', () => {
            // Arrange
            const result = geoToSvg({
                lat: String(DEFAULT_BOUNDS.latMax),
                lon: '-55.0',
                ...defaultInput
            });

            // Assert - clamped to right edge
            expect(result).not.toBeNull();
            expect(result!.x).toBeCloseTo(DEFAULT_SVG_WIDTH - 20, 0);
        });

        it('should clamp longitude exceeding the western bound', () => {
            // Arrange
            const result = geoToSvg({
                lat: String(DEFAULT_BOUNDS.latMax),
                lon: '-65.0',
                ...defaultInput
            });

            // Assert - clamped to left edge
            expect(result).not.toBeNull();
            expect(result!.x).toBeCloseTo(20, 0);
        });

        it('should return null for non-numeric latitude', () => {
            // Arrange & Act
            const result = geoToSvg({
                lat: 'abc',
                lon: '-58.0',
                ...defaultInput
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should return null for non-numeric longitude', () => {
            // Arrange & Act
            const result = geoToSvg({
                lat: '-32.0',
                lon: '',
                ...defaultInput
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should return null when both coordinates are invalid', () => {
            // Arrange & Act
            const result = geoToSvg({
                lat: 'invalid',
                lon: 'invalid',
                ...defaultInput
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should work with custom bounds and dimensions', () => {
            // Arrange
            const customBounds = { latMin: 0, latMax: 10, lonMin: 0, lonMax: 10 };
            const input = {
                lat: '5',
                lon: '5',
                bounds: customBounds,
                svgWidth: 100,
                svgHeight: 100
            };

            // Act
            const result = geoToSvg(input);

            // Assert
            expect(result).not.toBeNull();
            expect(result!.x).toBeCloseTo(50, 0);
            expect(result!.y).toBeCloseTo(50, 0);
        });

        it('should convert Concepcion del Uruguay coordinates correctly', () => {
            // Arrange - approximate coords for CdU
            const result = geoToSvg({
                lat: '-32.48',
                lon: '-58.23',
                ...defaultInput
            });

            // Assert - should be within valid SVG range
            expect(result).not.toBeNull();
            expect(result!.x).toBeGreaterThan(20);
            expect(result!.x).toBeLessThan(DEFAULT_SVG_WIDTH - 20);
            expect(result!.y).toBeGreaterThan(20);
            expect(result!.y).toBeLessThan(DEFAULT_SVG_HEIGHT - 20);
        });
    });

    describe('truncateName', () => {
        it('should return the full name when it fits within maxLength', () => {
            // Arrange
            const input = { name: 'Colon', maxLength: 14 };

            // Act
            const result = truncateName(input);

            // Assert
            expect(result).toEqual({ truncated: 'Colon' });
        });

        it('should return the full name when exactly at maxLength', () => {
            // Arrange
            const input = { name: 'Concepcion del', maxLength: 14 };

            // Act
            const result = truncateName(input);

            // Assert
            expect(result).toEqual({ truncated: 'Concepcion del' });
        });

        it('should truncate and add ellipsis when name exceeds maxLength', () => {
            // Arrange
            const input = { name: 'Concepcion del Uruguay', maxLength: 14 };

            // Act
            const result = truncateName(input);

            // Assert
            expect(result.truncated).toBe('Concepcion d\u2026');
            expect(result.truncated.length).toBe(13);
        });

        it('should handle very short maxLength', () => {
            // Arrange
            const input = { name: 'Gualeguaychu', maxLength: 5 };

            // Act
            const result = truncateName(input);

            // Assert
            expect(result.truncated).toBe('Gua\u2026');
        });

        it('should handle empty name', () => {
            // Arrange
            const input = { name: '', maxLength: 14 };

            // Act
            const result = truncateName(input);

            // Assert
            expect(result).toEqual({ truncated: '' });
        });

        it('should handle single character name within limit', () => {
            // Arrange
            const input = { name: 'A', maxLength: 14 };

            // Act
            const result = truncateName(input);

            // Assert
            expect(result).toEqual({ truncated: 'A' });
        });
    });

    describe('computeTooltipPosition', () => {
        it('should center tooltip horizontally on the marker', () => {
            // Arrange
            const input = { x: 100, y: 100, tooltipWidth: 80, svgWidth: 200 };

            // Act
            const result = computeTooltipPosition(input);

            // Assert
            expect(result.tooltipX).toBe(60); // 100 - 80/2
        });

        it('should position tooltip above the marker with 28px offset', () => {
            // Arrange
            const input = { x: 100, y: 100, tooltipWidth: 80, svgWidth: 200 };

            // Act
            const result = computeTooltipPosition(input);

            // Assert
            expect(result.tooltipY).toBe(72); // 100 - 28
        });

        it('should clamp tooltip to left edge when marker is near left', () => {
            // Arrange
            const input = { x: 10, y: 100, tooltipWidth: 80, svgWidth: 200 };

            // Act
            const result = computeTooltipPosition(input);

            // Assert
            expect(result.tooltipX).toBe(0);
        });

        it('should clamp tooltip to right edge when marker is near right', () => {
            // Arrange
            const input = { x: 190, y: 100, tooltipWidth: 80, svgWidth: 200 };

            // Act
            const result = computeTooltipPosition(input);

            // Assert
            expect(result.tooltipX).toBe(120); // 200 - 80
        });

        it('should clamp tooltip Y to 0 when marker is near top', () => {
            // Arrange
            const input = { x: 100, y: 20, tooltipWidth: 80, svgWidth: 200 };

            // Act
            const result = computeTooltipPosition(input);

            // Assert
            expect(result.tooltipY).toBe(0);
        });

        it('should handle marker at exact center of SVG', () => {
            // Arrange
            const input = { x: 100, y: 140, tooltipWidth: 80, svgWidth: 200 };

            // Act
            const result = computeTooltipPosition(input);

            // Assert
            expect(result.tooltipX).toBe(60);
            expect(result.tooltipY).toBe(112);
        });

        it('should handle marker at origin (0, 0)', () => {
            // Arrange
            const input = { x: 0, y: 0, tooltipWidth: 80, svgWidth: 200 };

            // Act
            const result = computeTooltipPosition(input);

            // Assert
            expect(result.tooltipX).toBe(0);
            expect(result.tooltipY).toBe(0);
        });
    });

    describe('Constants', () => {
        it('should export DEFAULT_BOUNDS matching LitoralMap.astro', () => {
            expect(DEFAULT_BOUNDS).toEqual({
                latMin: -34.1,
                latMax: -29.9,
                lonMin: -60.9,
                lonMax: -57.4
            });
        });

        it('should export correct SVG dimensions', () => {
            expect(DEFAULT_SVG_WIDTH).toBe(200);
            expect(DEFAULT_SVG_HEIGHT).toBe(280);
        });
    });
});
