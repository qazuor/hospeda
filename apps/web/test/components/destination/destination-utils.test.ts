/**
 * @file destination-utils.test.ts
 * @description Unit tests for destination utility functions.
 *
 * Tests functions imported directly from:
 *  - destination-map.utils.ts   — geoToSvg, truncateName, computeTooltipPosition
 *  - destination-preview.utils.ts — calculatePreviewPosition
 *  - destination-carousel.utils.ts — calculateActiveIndex, resolveKeyboardNavigation
 */

import { describe, expect, it } from 'vitest';

import {
    DEFAULT_BOUNDS,
    DEFAULT_SVG_HEIGHT,
    DEFAULT_SVG_WIDTH,
    computeTooltipPosition,
    geoToSvg,
    truncateName
} from '../../../src/components/destination/destination-map.utils';

import { calculatePreviewPosition } from '../../../src/components/destination/destination-preview.utils';

import {
    calculateActiveIndex,
    resolveKeyboardNavigation
} from '../../../src/components/destination/destination-carousel.utils';

// ─── destination-map.utils ────────────────────────────────────────────────────

describe('destination-map.utils', () => {
    describe('geoToSvg', () => {
        describe('Valid coordinate conversion', () => {
            it('should return x and y when given valid lat/lon strings', () => {
                const result = geoToSvg({
                    lat: '-32.0',
                    lon: '-58.5',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(result).not.toBeNull();
                expect(result).toHaveProperty('x');
                expect(result).toHaveProperty('y');
            });

            it('should produce x values within [margin, svgWidth - margin] range', () => {
                const result = geoToSvg({
                    lat: '-32.0',
                    lon: '-58.5',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(result).not.toBeNull();
                if (result) {
                    expect(result.x).toBeGreaterThanOrEqual(0);
                    expect(result.x).toBeLessThanOrEqual(DEFAULT_SVG_WIDTH);
                }
            });

            it('should produce y values within [0, svgHeight] range', () => {
                const result = geoToSvg({
                    lat: '-32.0',
                    lon: '-58.5',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(result).not.toBeNull();
                if (result) {
                    expect(result.y).toBeGreaterThanOrEqual(0);
                    expect(result.y).toBeLessThanOrEqual(DEFAULT_SVG_HEIGHT);
                }
            });

            it('should invert Y axis — a higher latitude produces a lower y value', () => {
                const north = geoToSvg({
                    lat: '-30.0',
                    lon: '-59.0',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                const south = geoToSvg({
                    lat: '-33.0',
                    lon: '-59.0',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(north).not.toBeNull();
                expect(south).not.toBeNull();
                if (north && south) {
                    expect(north.y).toBeLessThan(south.y);
                }
            });

            it('should produce x increasing as longitude increases', () => {
                const west = geoToSvg({
                    lat: '-32.0',
                    lon: '-60.0',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                const east = geoToSvg({
                    lat: '-32.0',
                    lon: '-58.0',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(west).not.toBeNull();
                expect(east).not.toBeNull();
                if (west && east) {
                    expect(east.x).toBeGreaterThan(west.x);
                }
            });
        });

        describe('Invalid input handling', () => {
            it('should return null for non-numeric lat string', () => {
                const result = geoToSvg({
                    lat: 'invalid',
                    lon: '-58.5',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(result).toBeNull();
            });

            it('should return null for non-numeric lon string', () => {
                const result = geoToSvg({
                    lat: '-32.0',
                    lon: 'bad',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(result).toBeNull();
            });

            it('should return null when both lat and lon are empty strings', () => {
                const result = geoToSvg({
                    lat: '',
                    lon: '',
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(result).toBeNull();
            });
        });

        describe('Boundary clamping', () => {
            it('should clamp coordinates outside bounds to within SVG range', () => {
                const result = geoToSvg({
                    lat: '-99.0', // well below latMin
                    lon: '-99.0', // well below lonMin
                    bounds: DEFAULT_BOUNDS,
                    svgWidth: DEFAULT_SVG_WIDTH,
                    svgHeight: DEFAULT_SVG_HEIGHT
                });
                expect(result).not.toBeNull();
                if (result) {
                    expect(result.x).toBeGreaterThanOrEqual(0);
                    expect(result.y).toBeGreaterThanOrEqual(0);
                    expect(result.x).toBeLessThanOrEqual(DEFAULT_SVG_WIDTH);
                    expect(result.y).toBeLessThanOrEqual(DEFAULT_SVG_HEIGHT);
                }
            });
        });

        describe('DEFAULT_BOUNDS constants', () => {
            it('should export DEFAULT_BOUNDS covering the Litoral region', () => {
                expect(DEFAULT_BOUNDS.latMin).toBeLessThan(DEFAULT_BOUNDS.latMax);
                expect(DEFAULT_BOUNDS.lonMin).toBeLessThan(DEFAULT_BOUNDS.lonMax);
            });

            it('should cover latitudes in the Entre Rios range', () => {
                expect(DEFAULT_BOUNDS.latMin).toBeLessThanOrEqual(-34);
                expect(DEFAULT_BOUNDS.latMax).toBeGreaterThanOrEqual(-30);
            });

            it('should export DEFAULT_SVG_WIDTH as 200', () => {
                expect(DEFAULT_SVG_WIDTH).toBe(200);
            });

            it('should export DEFAULT_SVG_HEIGHT as 280', () => {
                expect(DEFAULT_SVG_HEIGHT).toBe(280);
            });
        });
    });

    describe('truncateName', () => {
        it('should return the name unchanged when it is shorter than maxLength', () => {
            const { truncated } = truncateName({ name: 'Colón', maxLength: 20 });
            expect(truncated).toBe('Colón');
        });

        it('should return the name unchanged when it equals maxLength', () => {
            const name = 'Concepcion';
            const { truncated } = truncateName({ name, maxLength: name.length });
            expect(truncated).toBe(name);
        });

        it('should truncate and append ellipsis when name exceeds maxLength', () => {
            const { truncated } = truncateName({
                name: 'Concepcion del Uruguay',
                maxLength: 12
            });
            expect(truncated.length).toBeLessThanOrEqual(12);
            expect(truncated.endsWith('\u2026')).toBe(true);
        });

        it('should produce truncated length of maxLength (name minus 2 chars + ellipsis)', () => {
            const maxLength = 10;
            const { truncated } = truncateName({
                name: 'A very long destination name',
                maxLength
            });
            // truncated = slice(0, maxLength - 2) + ellipsis = (maxLength - 2) + 1 char = maxLength - 1
            expect(truncated.length).toBe(maxLength - 1);
        });

        it('should handle empty string without throwing', () => {
            const { truncated } = truncateName({ name: '', maxLength: 10 });
            expect(truncated).toBe('');
        });
    });

    describe('computeTooltipPosition', () => {
        it('should center tooltip horizontally on the marker', () => {
            const { tooltipX } = computeTooltipPosition({
                x: 100,
                y: 100,
                tooltipWidth: 60,
                svgWidth: 200
            });
            // centred: x - tooltipWidth/2 = 100 - 30 = 70
            expect(tooltipX).toBe(70);
        });

        it('should clamp tooltipX to 0 when marker is near the left edge', () => {
            const { tooltipX } = computeTooltipPosition({
                x: 10,
                y: 50,
                tooltipWidth: 60,
                svgWidth: 200
            });
            expect(tooltipX).toBeGreaterThanOrEqual(0);
        });

        it('should clamp tooltipX to prevent right overflow', () => {
            const tooltipWidth = 60;
            const svgWidth = 200;
            const { tooltipX } = computeTooltipPosition({
                x: 190,
                y: 50,
                tooltipWidth,
                svgWidth
            });
            expect(tooltipX).toBeLessThanOrEqual(svgWidth - tooltipWidth);
        });

        it('should place tooltip above the marker by default (28px gap)', () => {
            const { tooltipY } = computeTooltipPosition({
                x: 100,
                y: 100,
                tooltipWidth: 60,
                svgWidth: 200
            });
            expect(tooltipY).toBe(72); // 100 - 28
        });

        it('should clamp tooltipY to 0 when marker is near the top', () => {
            const { tooltipY } = computeTooltipPosition({
                x: 100,
                y: 5,
                tooltipWidth: 60,
                svgWidth: 200
            });
            expect(tooltipY).toBe(0);
        });
    });
});

// ─── destination-preview.utils ───────────────────────────────────────────────

describe('destination-preview.utils', () => {
    describe('calculatePreviewPosition', () => {
        const BASE_INPUT = {
            triggerRect: { top: 200, bottom: 300, left: 50 },
            previewWidth: 288,
            previewHeight: 320,
            viewportWidth: 1280,
            viewportHeight: 800
        };

        it('should return an object with left and top properties', () => {
            const result = calculatePreviewPosition(BASE_INPUT);
            expect(result).toHaveProperty('left');
            expect(result).toHaveProperty('top');
        });

        it('should prefer positioning below the card when there is room', () => {
            const result = calculatePreviewPosition(BASE_INPUT);
            // bottom (300) + gap (8) = 308, panel ends at 308 + 320 = 628 < 800
            expect(result.top).toBeGreaterThanOrEqual(300);
        });

        it('should fall back to above the card when the preview overflows the bottom', () => {
            const result = calculatePreviewPosition({
                triggerRect: { top: 600, bottom: 700, left: 50 },
                previewWidth: 288,
                previewHeight: 320,
                viewportWidth: 1280,
                viewportHeight: 800
            });
            // 700 + 8 + 320 = 1028 > 800, so should go above: 600 - 320 - 8 = 272
            expect(result.top).toBeLessThan(600);
        });

        it('should clamp top to at least EDGE_PADDING (8px) from the viewport top', () => {
            const result = calculatePreviewPosition({
                triggerRect: { top: 10, bottom: 50, left: 50 },
                previewWidth: 288,
                previewHeight: 320,
                viewportWidth: 1280,
                viewportHeight: 800
            });
            expect(result.top).toBeGreaterThanOrEqual(8);
        });

        it('should align preview with the card left edge when it fits horizontally', () => {
            const result = calculatePreviewPosition(BASE_INPUT);
            // left=50, previewWidth=288, 50+288=338 < 1280 — no clamping needed
            expect(result.left).toBe(50);
        });

        it('should clamp left when the preview would overflow the right edge', () => {
            const result = calculatePreviewPosition({
                triggerRect: { top: 200, bottom: 300, left: 1100 },
                previewWidth: 288,
                previewHeight: 320,
                viewportWidth: 1280,
                viewportHeight: 800
            });
            // 1100 + 288 = 1388 > 1280, so clamp: 1280 - 288 - 16 = 976
            expect(result.left).toBeLessThanOrEqual(1100);
            expect(result.left).toBe(1280 - 288 - 16);
        });

        it('should return numeric pixel values for both coordinates', () => {
            const { left, top } = calculatePreviewPosition(BASE_INPUT);
            expect(typeof left).toBe('number');
            expect(typeof top).toBe('number');
            expect(Number.isNaN(left)).toBe(false);
            expect(Number.isNaN(top)).toBe(false);
        });
    });
});

// ─── destination-carousel.utils ──────────────────────────────────────────────

describe('destination-carousel.utils', () => {
    describe('calculateActiveIndex', () => {
        it('should return index 0 when scrollLeft is 0', () => {
            const { activeIndex } = calculateActiveIndex({
                scrollLeft: 0,
                itemWidth: 300,
                itemCount: 5
            });
            expect(activeIndex).toBe(0);
        });

        it('should return the nearest index based on scrollLeft', () => {
            const { activeIndex } = calculateActiveIndex({
                scrollLeft: 310,
                itemWidth: 300,
                itemCount: 5
            });
            expect(activeIndex).toBe(1);
        });

        it('should round to the nearest index (0.5 rounds up)', () => {
            const { activeIndex } = calculateActiveIndex({
                scrollLeft: 450,
                itemWidth: 300,
                itemCount: 5
            });
            // 450 / 300 = 1.5 -> Math.round -> 2
            expect(activeIndex).toBe(2);
        });

        it('should clamp to 0 for negative scrollLeft', () => {
            const { activeIndex } = calculateActiveIndex({
                scrollLeft: -100,
                itemWidth: 300,
                itemCount: 5
            });
            expect(activeIndex).toBe(0);
        });

        it('should clamp to itemCount - 1 for very large scrollLeft', () => {
            const { activeIndex } = calculateActiveIndex({
                scrollLeft: 99999,
                itemWidth: 300,
                itemCount: 5
            });
            expect(activeIndex).toBe(4);
        });

        it('should return 0 when itemCount is 0', () => {
            const { activeIndex } = calculateActiveIndex({
                scrollLeft: 300,
                itemWidth: 300,
                itemCount: 0
            });
            expect(activeIndex).toBe(0);
        });

        it('should return 0 when itemWidth is 0', () => {
            const { activeIndex } = calculateActiveIndex({
                scrollLeft: 300,
                itemWidth: 0,
                itemCount: 5
            });
            expect(activeIndex).toBe(0);
        });
    });

    describe('resolveKeyboardNavigation', () => {
        describe('ArrowRight', () => {
            it('should return currentIndex + 1', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'ArrowRight',
                    currentIndex: 2,
                    itemCount: 5
                });
                expect(targetIndex).toBe(3);
            });

            it('should clamp to itemCount - 1 at the last item', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'ArrowRight',
                    currentIndex: 4,
                    itemCount: 5
                });
                expect(targetIndex).toBe(4);
            });
        });

        describe('ArrowLeft', () => {
            it('should return currentIndex - 1', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'ArrowLeft',
                    currentIndex: 2,
                    itemCount: 5
                });
                expect(targetIndex).toBe(1);
            });

            it('should clamp to 0 at the first item', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'ArrowLeft',
                    currentIndex: 0,
                    itemCount: 5
                });
                expect(targetIndex).toBe(0);
            });
        });

        describe('ArrowDown', () => {
            it('should behave the same as ArrowRight', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'ArrowDown',
                    currentIndex: 1,
                    itemCount: 5
                });
                expect(targetIndex).toBe(2);
            });
        });

        describe('ArrowUp', () => {
            it('should behave the same as ArrowLeft', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'ArrowUp',
                    currentIndex: 3,
                    itemCount: 5
                });
                expect(targetIndex).toBe(2);
            });
        });

        describe('Home', () => {
            it('should always return 0', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'Home',
                    currentIndex: 4,
                    itemCount: 5
                });
                expect(targetIndex).toBe(0);
            });
        });

        describe('End', () => {
            it('should always return itemCount - 1', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'End',
                    currentIndex: 0,
                    itemCount: 5
                });
                expect(targetIndex).toBe(4);
            });
        });

        describe('Non-navigation keys', () => {
            it('should return null for Enter', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'Enter',
                    currentIndex: 2,
                    itemCount: 5
                });
                expect(targetIndex).toBeNull();
            });

            it('should return null for Escape', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'Escape',
                    currentIndex: 2,
                    itemCount: 5
                });
                expect(targetIndex).toBeNull();
            });

            it('should return null for Space', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: ' ',
                    currentIndex: 0,
                    itemCount: 5
                });
                expect(targetIndex).toBeNull();
            });

            it('should return null for arbitrary characters', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'a',
                    currentIndex: 0,
                    itemCount: 5
                });
                expect(targetIndex).toBeNull();
            });
        });

        describe('Edge cases', () => {
            it('should return null when itemCount is 0', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'ArrowRight',
                    currentIndex: 0,
                    itemCount: 0
                });
                expect(targetIndex).toBeNull();
            });

            it('should handle single-item carousels without errors', () => {
                const { targetIndex } = resolveKeyboardNavigation({
                    key: 'ArrowRight',
                    currentIndex: 0,
                    itemCount: 1
                });
                expect(targetIndex).toBe(0);
            });
        });
    });
});
