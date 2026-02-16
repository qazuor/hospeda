import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/accommodation/AmenitiesList.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('AmenitiesList.astro', () => {
    describe('Props', () => {
        it('should define AmenityItem interface', () => {
            expect(content).toContain('interface AmenityItem');
        });

        it('should accept amenities prop as array', () => {
            expect(content).toContain('amenities: AmenityItem[]');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should have name property in AmenityItem', () => {
            expect(content).toContain('name: string');
        });

        it('should have optional icon property in AmenityItem', () => {
            expect(content).toContain('icon?: string');
        });

        it('should have slug property in AmenityItem', () => {
            expect(content).toContain('slug: string');
        });
    });

    describe('Structure', () => {
        it('should use ul element with role list', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('role="list"');
        });

        it('should use li elements for amenities', () => {
            expect(content).toContain('<li');
        });

        it('should use grid layout', () => {
            expect(content).toContain('grid');
        });

        it('should have responsive columns', () => {
            expect(content).toContain('grid-cols-2');
            expect(content).toContain('sm:grid-cols-3');
        });
    });

    describe('Icon rendering', () => {
        it('should render custom icon if provided', () => {
            expect(content).toContain('amenity.icon');
        });

        it('should define default icon SVG', () => {
            expect(content).toContain('defaultIcon');
            expect(content).toContain('svg');
        });

        it('should use default icon when custom icon not provided', () => {
            expect(content).toContain('defaultIcon');
        });

        it('should hide icons from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Styling', () => {
        it('should use text-text-secondary for items', () => {
            expect(content).toContain('text-text-secondary');
        });

        it('should use text-primary for icons', () => {
            expect(content).toContain('text-primary');
        });

        it('should have compact spacing with gap', () => {
            expect(content).toContain('gap-');
        });

        it('should use flex layout for item content', () => {
            expect(content).toContain('flex items-center');
        });

        it('should prevent icon shrinking', () => {
            expect(content).toContain('flex-shrink-0');
        });
    });

    describe('Content', () => {
        it('should display amenity name', () => {
            expect(content).toContain('amenity.name');
        });

        it('should map over amenities array', () => {
            expect(content).toContain('amenities.map');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic list markup', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('<li');
        });

        it('should have explicit role="list"', () => {
            expect(content).toContain('role="list"');
        });

        it('should hide decorative icons from assistive tech', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Customization', () => {
        it('should accept custom classes via class prop', () => {
            expect(content).toContain('className');
        });

        it('should merge custom classes with default classes', () => {
            expect(content).toContain('class:list');
        });
    });
});
