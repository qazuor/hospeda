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

        it('should import CheckIcon from @repo/icons', () => {
            expect(content).toContain("import { CheckIcon } from '@repo/icons'");
        });

        it('should use CheckIcon as default when custom icon not provided', () => {
            expect(content).toContain('CheckIcon');
            expect(content).toContain('size={16}');
            expect(content).toContain('weight="bold"');
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

        it('should iterate over sorted amenities array', () => {
            expect(content).toContain('sortedAmenities.map');
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

    describe('Display Weight sorting', () => {
        it('should include displayWeight as optional field in AmenityItem', () => {
            expect(content).toContain('displayWeight?: number');
        });

        it('should sort amenities by displayWeight DESC before rendering', () => {
            expect(content).toContain(
                '.sort(\n  (a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50)\n)'
            );
        });

        it('should use sorted array for rendering, not the original', () => {
            expect(content).toContain('sortedAmenities.map');
            expect(content).not.toMatch(/\bamenities\.map\b/);
        });

        it('should create a new array to avoid mutating props', () => {
            expect(content).toContain('[...amenities].sort');
        });

        it('should default to weight 50 when displayWeight is absent', () => {
            expect(content).toMatch(
                /b\.displayWeight\s*\?\?\s*50\)\s*-\s*\(a\.displayWeight\s*\?\?\s*50/
            );
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
