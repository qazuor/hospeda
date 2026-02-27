import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/destination/LitoralMap.astro');
const content = readFileSync(componentPath, 'utf8');

describe('LitoralMap.astro', () => {
    describe('SVG structure', () => {
        it('should render an SVG element', () => {
            expect(content).toContain('<svg');
        });

        it('should have province outline path', () => {
            expect(content).toContain('<path');
        });

        it('should render river paths', () => {
            expect(content).toContain('stroke-dasharray');
        });

        it('should have radial gradient definition for province fill', () => {
            expect(content).toContain('<radialGradient');
            expect(content).toContain('id="province-fill"');
        });

        it('should use gradient fill on province path', () => {
            expect(content).toContain('fill="url(#province-fill)"');
        });

        it('should render map title text', () => {
            expect(content).toContain('{mapTitle}');
        });
    });

    describe('River labels', () => {
        it('should have id on Parana river path', () => {
            expect(content).toContain('id="parana-river"');
        });

        it('should have id on Uruguay river path', () => {
            expect(content).toContain('id="uruguay-river"');
        });

        it('should render river labels with textPath', () => {
            expect(content).toContain('<textPath');
            expect(content).toContain('href="#parana-river"');
            expect(content).toContain('href="#uruguay-river"');
        });

        it('should use i18n for river names', () => {
            expect(content).toContain('featured.map.riverParana');
            expect(content).toContain('featured.map.riverUruguay');
        });
    });

    describe('Coordinate system', () => {
        it('should import geographic bounds from utility module', () => {
            expect(content).toContain('DEFAULT_BOUNDS');
            expect(content).toContain('destination-map.utils');
        });

        it('should have geoToSvg conversion function', () => {
            expect(content).toContain('geoToSvg');
        });

        it('should filter destinations with coordinates', () => {
            expect(content).toContain('mappableDestinations');
        });
    });

    describe('Markers', () => {
        it('should render circle markers', () => {
            expect(content).toContain('<circle');
        });

        it('should have tooltip on hover', () => {
            expect(content).toContain('marker-tooltip');
        });

        it('should have pulse animation using transform scale', () => {
            expect(content).toContain('marker-pulse');
            expect(content).toContain('mapPulse');
            expect(content).toContain('transform: scale(');
        });
    });

    describe('Visibility', () => {
        it('should be hidden on mobile/tablet', () => {
            expect(content).toContain('hidden lg:flex');
        });
    });

    describe('Interactivity', () => {
        it('should scroll to card on click', () => {
            expect(content).toContain('scrollIntoView');
        });

        it('should highlight card temporarily', () => {
            expect(content).toContain('ring-2');
            expect(content).toContain('ring-primary');
        });

        it('should support keyboard navigation', () => {
            expect(content).toContain('tabindex="0"');
            expect(content).toContain("'Enter'");
        });
    });

    describe('Bidirectional hover', () => {
        it('should listen for mouseenter on destination cards', () => {
            expect(content).toContain("addEventListener('mouseenter'");
        });

        it('should listen for mouseleave on destination cards', () => {
            expect(content).toContain("addEventListener('mouseleave'");
        });

        it('should add map-marker-active class on card hover', () => {
            expect(content).toContain('map-marker-active');
        });

        it('should have CSS rules for map-marker-active state', () => {
            expect(content).toContain('.map-marker.map-marker-active .marker-tooltip');
            expect(content).toContain('.map-marker.map-marker-active .marker-pulse');
        });
    });

    describe('Draw animation', () => {
        it('should have province-outline class on province path', () => {
            expect(content).toContain('class="province-outline"');
        });

        it('should use stroke-dasharray for draw animation', () => {
            expect(content).toContain('stroke-dasharray: 900');
            expect(content).toContain('stroke-dashoffset: 900');
        });

        it('should animate on scroll-visible', () => {
            expect(content).toContain('.scroll-visible .province-outline');
            expect(content).toContain('stroke-dashoffset: 0');
        });

        it('should have river-path class for fade-in', () => {
            expect(content).toContain('class="river-path"');
        });
    });

    describe('Data attribution', () => {
        it('should reference Natural Earth as data source', () => {
            expect(content).toContain('Natural Earth');
        });

        it('should reference the generation script', () => {
            expect(content).toContain('generate-entre-rios-svg.ts');
        });
    });

    describe('Design tokens', () => {
        it('should use CSS custom properties for colors', () => {
            expect(content).toContain('var(--color-primary)');
            expect(content).toContain('var(--color-surface)');
            expect(content).toContain('var(--color-border)');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on container', () => {
            expect(content).toContain('aria-label={mapLabel}');
        });

        it('should have role=button on markers', () => {
            expect(content).toContain('role="button"');
        });

        it('should have aria-label on markers', () => {
            expect(content).toContain('featured.map.showOnPage');
        });

        it('should respect prefers-reduced-motion', () => {
            expect(content).toContain('prefers-reduced-motion');
        });

        it('should use focus-visible for keyboard focus ring', () => {
            expect(content).toContain(':focus-visible');
        });

        it('should disable draw animation for reduced motion', () => {
            expect(content).toContain('stroke-dasharray: none');
        });
    });

    describe('Dark mode', () => {
        it('should use CSS variable for marker stroke instead of hardcoded white', () => {
            expect(content).toContain('stroke="var(--color-bg)"');
            expect(content).not.toContain('stroke="white"');
        });
    });
});
