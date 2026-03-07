/**
 * @file litoral-map.test.ts
 * @description Tests for LitoralMap.astro and destination-map.utils.ts.
 * Validates the SVG map structure, marker rendering, tooltip positioning,
 * geographic coordinate conversion, name truncation, and default constants.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DEFAULT_BOUNDS,
    DEFAULT_SVG_HEIGHT,
    DEFAULT_SVG_WIDTH,
    computeTooltipPosition,
    geoToSvg,
    truncateName
} from '../../../src/components/destination/destination-map.utils';

const astroPath = resolve(__dirname, '../../../src/components/destination/LitoralMap.astro');
const astroContent = readFileSync(astroPath, 'utf8');

// ── LitoralMap.astro structure tests ──────────────────────────────────────────

describe('LitoralMap.astro', () => {
    describe('File documentation', () => {
        it('should have JSDoc documentation', () => {
            expect(astroContent).toContain('/**');
            expect(astroContent).toContain('*/');
        });

        it('should describe the SVG mini-map purpose', () => {
            expect(astroContent.toLowerCase()).toMatch(/map|litoral|entre r/);
        });
    });

    describe('Props interface', () => {
        it('should define MapDestination interface', () => {
            expect(astroContent).toContain('interface MapDestination');
        });

        it('should define Props interface', () => {
            expect(astroContent).toContain('interface Props');
        });

        it('should accept destinations prop as ReadonlyArray', () => {
            expect(astroContent).toContain('destinations');
        });

        it('should accept optional locale prop', () => {
            expect(astroContent).toContain('locale?');
        });

        it('should accept optional class prop', () => {
            expect(astroContent).toContain('class?: string');
        });

        it('should default locale to "es"', () => {
            expect(astroContent).toContain("locale = 'es'");
        });

        it('should have slug property in MapDestination', () => {
            expect(astroContent).toContain('slug: string');
        });

        it('should have name property in MapDestination', () => {
            expect(astroContent).toContain('name: string');
        });

        it('should have optional coordinates in MapDestination', () => {
            expect(astroContent).toContain('coordinates?');
        });
    });

    describe('SVG structure', () => {
        it('should render an svg element', () => {
            expect(astroContent).toContain('<svg');
        });

        it('should set role="img" on the SVG', () => {
            expect(astroContent).toContain('role="img"');
        });

        it('should set aria-label on the SVG from mapLabel', () => {
            expect(astroContent).toContain('aria-label={mapLabel}');
        });

        it('should render the province outline path', () => {
            expect(astroContent).toContain('province-outline');
        });

        it('should render Parana river path', () => {
            expect(astroContent).toContain('parana-river');
        });

        it('should render Uruguay river path', () => {
            expect(astroContent).toContain('uruguay-river');
        });

        it('should render the map title text element', () => {
            expect(astroContent).toContain('{mapTitle}');
        });

        it('should render river label text paths', () => {
            expect(astroContent).toContain('{riverParana}');
            expect(astroContent).toContain('{riverUruguay}');
        });
    });

    describe('Marker rendering', () => {
        it('should iterate over mappableDestinations to render markers', () => {
            expect(astroContent).toContain('mappableDestinations.map');
        });

        it('should set data-map-marker attribute on each marker group', () => {
            expect(astroContent).toContain('data-map-marker={dest.slug}');
        });

        it('should render marker dot circles', () => {
            expect(astroContent).toContain('<circle');
        });

        it('should set role="button" on marker groups for interactivity', () => {
            expect(astroContent).toContain('role="button"');
        });

        it('should set tabindex="0" on marker groups for keyboard access', () => {
            expect(astroContent).toContain('tabindex="0"');
        });

        it('should filter out destinations without valid coordinates', () => {
            expect(astroContent).toContain('d.coordinates?.lat');
            expect(astroContent).toContain('d.coordinates?.long');
        });

        it('should use geoToSvg to convert coordinates to SVG positions', () => {
            expect(astroContent).toContain('geoToSvg(');
        });

        it('should use computeTooltipPosition for tooltip placement', () => {
            expect(astroContent).toContain('computeTooltipPosition(');
        });

        it('should use truncateName for long destination names in tooltips', () => {
            expect(astroContent).toContain('truncateName(');
        });
    });

    describe('Tooltip', () => {
        it('should render a tooltip rect element', () => {
            expect(astroContent).toContain('marker-tooltip');
        });

        it('should compute tooltip x and y positions', () => {
            expect(astroContent).toContain('tooltipX');
            expect(astroContent).toContain('tooltipY');
        });

        it('should use TOOLTIP_WIDTH constant of 80', () => {
            expect(astroContent).toContain('TOOLTIP_WIDTH = 80');
        });
    });

    describe('Animation and interactivity script', () => {
        it('should include an inline script block', () => {
            expect(astroContent).toContain('<script>');
        });

        it('should scroll to destination card on marker click', () => {
            expect(astroContent).toContain('scrollIntoView');
        });

        it('should re-initialise on astro:page-load for view transitions', () => {
            expect(astroContent).toContain('astro:page-load');
        });

        it('should abort listeners on astro:before-swap', () => {
            expect(astroContent).toContain('astro:before-swap');
        });

        it('should use an AbortController for cleanup', () => {
            expect(astroContent).toContain('AbortController');
        });
    });

    describe('Accessibility', () => {
        it('should use aside element with aria-label as the root', () => {
            expect(astroContent).toContain('<aside');
            expect(astroContent).toContain('aria-label={mapLabel}');
        });

        it('should have aria-label on each marker group', () => {
            expect(astroContent).toContain('aria-label=');
        });

        it('should only show on large screens via hidden/lg:flex', () => {
            expect(astroContent).toContain('hidden');
            expect(astroContent).toContain('lg:flex');
        });
    });

    describe('Imports', () => {
        it('should import DEFAULT_BOUNDS from destination-map.utils', () => {
            expect(astroContent).toContain('DEFAULT_BOUNDS');
        });

        it('should import DEFAULT_SVG_WIDTH and DEFAULT_SVG_HEIGHT from utils', () => {
            expect(astroContent).toContain('DEFAULT_SVG_WIDTH');
            expect(astroContent).toContain('DEFAULT_SVG_HEIGHT');
        });
    });
});

// ── destination-map.utils.ts pure function tests ───────────────────────────────

describe('destination-map.utils — geoToSvg', () => {
    const defaultInput = {
        bounds: DEFAULT_BOUNDS,
        svgWidth: DEFAULT_SVG_WIDTH,
        svgHeight: DEFAULT_SVG_HEIGHT
    };

    it('should place the center of the bounds at the center of the SVG', () => {
        // Arrange
        const midLat = (DEFAULT_BOUNDS.latMin + DEFAULT_BOUNDS.latMax) / 2;
        const midLon = (DEFAULT_BOUNDS.lonMin + DEFAULT_BOUNDS.lonMax) / 2;

        // Act
        const result = geoToSvg({ lat: String(midLat), lon: String(midLon), ...defaultInput });

        // Assert
        expect(result).not.toBeNull();
        expect(result!.x).toBeCloseTo(DEFAULT_SVG_WIDTH / 2, 0);
        expect(result!.y).toBeCloseTo(DEFAULT_SVG_HEIGHT / 2, 0);
    });

    it('should place the north-west corner at (margin, margin)', () => {
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

    it('should place the south-east corner at (width-margin, height-margin)', () => {
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

    it('should clamp latitude above the northern bound to the top edge', () => {
        // Arrange - lat beyond latMax
        const result = geoToSvg({
            lat: '-25.0',
            lon: String(DEFAULT_BOUNDS.lonMin),
            ...defaultInput
        });

        // Assert
        expect(result).not.toBeNull();
        expect(result!.y).toBeCloseTo(20, 0);
    });

    it('should clamp latitude below the southern bound to the bottom edge', () => {
        // Arrange - lat below latMin
        const result = geoToSvg({
            lat: '-40.0',
            lon: String(DEFAULT_BOUNDS.lonMin),
            ...defaultInput
        });

        // Assert
        expect(result).not.toBeNull();
        expect(result!.y).toBeCloseTo(DEFAULT_SVG_HEIGHT - 20, 0);
    });

    it('should clamp longitude past the eastern bound to the right edge', () => {
        // Arrange
        const result = geoToSvg({
            lat: String(DEFAULT_BOUNDS.latMax),
            lon: '-55.0',
            ...defaultInput
        });

        // Assert
        expect(result).not.toBeNull();
        expect(result!.x).toBeCloseTo(DEFAULT_SVG_WIDTH - 20, 0);
    });

    it('should clamp longitude past the western bound to the left edge', () => {
        // Arrange
        const result = geoToSvg({
            lat: String(DEFAULT_BOUNDS.latMax),
            lon: '-65.0',
            ...defaultInput
        });

        // Assert
        expect(result).not.toBeNull();
        expect(result!.x).toBeCloseTo(20, 0);
    });

    it('should return null for a non-numeric latitude', () => {
        // Arrange & Act
        const result = geoToSvg({ lat: 'abc', lon: '-58.0', ...defaultInput });

        // Assert
        expect(result).toBeNull();
    });

    it('should return null for a non-numeric longitude', () => {
        // Arrange & Act
        const result = geoToSvg({ lat: '-32.0', lon: '', ...defaultInput });

        // Assert
        expect(result).toBeNull();
    });

    it('should return null when both lat and lon are invalid', () => {
        // Arrange & Act
        const result = geoToSvg({ lat: 'invalid', lon: 'invalid', ...defaultInput });

        // Assert
        expect(result).toBeNull();
    });

    it('should produce valid SVG coordinates for Concepcion del Uruguay', () => {
        // Arrange
        const result = geoToSvg({ lat: '-32.48', lon: '-58.23', ...defaultInput });

        // Assert
        expect(result).not.toBeNull();
        expect(result!.x).toBeGreaterThan(20);
        expect(result!.x).toBeLessThan(DEFAULT_SVG_WIDTH - 20);
        expect(result!.y).toBeGreaterThan(20);
        expect(result!.y).toBeLessThan(DEFAULT_SVG_HEIGHT - 20);
    });

    it('should work with arbitrary custom bounds and dimensions', () => {
        // Arrange
        const customBounds = { latMin: 0, latMax: 10, lonMin: 0, lonMax: 10 };

        // Act
        const result = geoToSvg({
            lat: '5',
            lon: '5',
            bounds: customBounds,
            svgWidth: 100,
            svgHeight: 100
        });

        // Assert
        expect(result).not.toBeNull();
        expect(result!.x).toBeCloseTo(50, 0);
        expect(result!.y).toBeCloseTo(50, 0);
    });
});

describe('destination-map.utils — truncateName', () => {
    it('should return the full name when it fits within maxLength', () => {
        // Arrange & Act
        const result = truncateName({ name: 'Colon', maxLength: 14 });

        // Assert
        expect(result).toEqual({ truncated: 'Colon' });
    });

    it('should return the full name when it is exactly maxLength characters', () => {
        // Arrange & Act
        const result = truncateName({ name: 'Concepcion del', maxLength: 14 });

        // Assert
        expect(result).toEqual({ truncated: 'Concepcion del' });
    });

    it('should truncate and append ellipsis when name exceeds maxLength', () => {
        // Arrange & Act
        const result = truncateName({ name: 'Concepcion del Uruguay', maxLength: 14 });

        // Assert
        expect(result.truncated).toBe('Concepcion d\u2026');
        expect(result.truncated.length).toBe(13);
    });

    it('should handle very short maxLength', () => {
        // Arrange & Act
        const result = truncateName({ name: 'Gualeguaychu', maxLength: 5 });

        // Assert
        expect(result.truncated).toBe('Gua\u2026');
    });

    it('should return an empty string for an empty name', () => {
        // Arrange & Act
        const result = truncateName({ name: '', maxLength: 14 });

        // Assert
        expect(result).toEqual({ truncated: '' });
    });

    it('should return a single character when name length is 1 and maxLength is greater', () => {
        // Arrange & Act
        const result = truncateName({ name: 'A', maxLength: 14 });

        // Assert
        expect(result).toEqual({ truncated: 'A' });
    });
});

describe('destination-map.utils — computeTooltipPosition', () => {
    it('should centre the tooltip horizontally on the marker', () => {
        // Arrange & Act
        const result = computeTooltipPosition({ x: 100, y: 100, tooltipWidth: 80, svgWidth: 200 });

        // Assert
        expect(result.tooltipX).toBe(60); // 100 - 80/2
    });

    it('should position the tooltip 28px above the marker', () => {
        // Arrange & Act
        const result = computeTooltipPosition({ x: 100, y: 100, tooltipWidth: 80, svgWidth: 200 });

        // Assert
        expect(result.tooltipY).toBe(72); // 100 - 28
    });

    it('should clamp tooltip to left edge (x=0) when marker is near left', () => {
        // Arrange & Act
        const result = computeTooltipPosition({ x: 10, y: 100, tooltipWidth: 80, svgWidth: 200 });

        // Assert
        expect(result.tooltipX).toBe(0);
    });

    it('should clamp tooltip to right edge when marker is near right', () => {
        // Arrange & Act
        const result = computeTooltipPosition({ x: 190, y: 100, tooltipWidth: 80, svgWidth: 200 });

        // Assert
        expect(result.tooltipX).toBe(120); // 200 - 80
    });

    it('should clamp tooltip Y to 0 when marker is near the top', () => {
        // Arrange & Act
        const result = computeTooltipPosition({ x: 100, y: 20, tooltipWidth: 80, svgWidth: 200 });

        // Assert
        expect(result.tooltipY).toBe(0);
    });

    it('should produce correct position for a marker at the SVG centre', () => {
        // Arrange & Act
        const result = computeTooltipPosition({ x: 100, y: 140, tooltipWidth: 80, svgWidth: 200 });

        // Assert
        expect(result.tooltipX).toBe(60);
        expect(result.tooltipY).toBe(112);
    });

    it('should clamp both axes to 0 for a marker at the origin', () => {
        // Arrange & Act
        const result = computeTooltipPosition({ x: 0, y: 0, tooltipWidth: 80, svgWidth: 200 });

        // Assert
        expect(result.tooltipX).toBe(0);
        expect(result.tooltipY).toBe(0);
    });
});

describe('destination-map.utils — exported constants', () => {
    it('should export DEFAULT_BOUNDS matching the Entre Rios region', () => {
        // Assert
        expect(DEFAULT_BOUNDS).toEqual({
            latMin: -34.1,
            latMax: -29.9,
            lonMin: -60.9,
            lonMax: -57.4
        });
    });

    it('should export DEFAULT_SVG_WIDTH of 200', () => {
        // Assert
        expect(DEFAULT_SVG_WIDTH).toBe(200);
    });

    it('should export DEFAULT_SVG_HEIGHT of 280', () => {
        // Assert
        expect(DEFAULT_SVG_HEIGHT).toBe(280);
    });
});
