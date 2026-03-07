/**
 * @file amenities-list.test.ts
 * @description Tests for AmenitiesList.astro.
 * Validates props interface, grid layout, icon rendering, display-weight
 * sorting logic, accessibility attributes, and CSS token usage.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/AmenitiesList.astro');
const content = readFileSync(componentPath, 'utf8');

describe('AmenitiesList.astro', () => {
    describe('File documentation', () => {
        it('should have JSDoc documentation on the component', () => {
            expect(content).toContain('/**');
            expect(content).toContain('*/');
        });

        it('should describe the amenities display purpose', () => {
            expect(content.toLowerCase()).toMatch(/ameniti/);
        });
    });

    describe('Props interface', () => {
        it('should define AmenityItem interface', () => {
            expect(content).toContain('interface AmenityItem');
        });

        it('should define Props interface', () => {
            expect(content).toContain('interface Props');
        });

        it('should accept amenities prop as readonly array', () => {
            expect(content).toContain('amenities');
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

        it('should have optional displayWeight property in AmenityItem', () => {
            expect(content).toContain('displayWeight?: number');
        });

        it('should use readonly props', () => {
            expect(content).toContain('readonly');
        });
    });

    describe('Structure', () => {
        it('should render a ul element as the root list container', () => {
            expect(content).toContain('<ul');
        });

        it('should render li elements for each amenity', () => {
            expect(content).toContain('<li');
        });

        it('should use role="list" for accessibility', () => {
            expect(content).toContain('role="list"');
        });

        it('should display amenity name in each item', () => {
            expect(content).toContain('amenity.name');
        });

        it('should iterate over sortedAmenities array (not raw amenities)', () => {
            expect(content).toContain('sortedAmenities.map');
        });
    });

    describe('Grid layout', () => {
        it('should use a CSS grid layout', () => {
            expect(content).toContain('grid');
        });

        it('should have 2-column grid by default', () => {
            expect(content).toContain('grid-cols-2');
        });

        it('should switch to 3 columns on sm breakpoint', () => {
            expect(content).toContain('sm:grid-cols-3');
        });

        it('should use gap for item spacing', () => {
            expect(content).toMatch(/gap-\d/);
        });

        it('should use flex layout inside each list item', () => {
            expect(content).toContain('flex items-center');
        });
    });

    describe('Icon rendering', () => {
        it('should import CheckIcon from @repo/icons as default fallback', () => {
            expect(content).toContain("import { CheckIcon } from '@repo/icons'");
        });

        it('should render custom icon HTML when provided', () => {
            expect(content).toContain('amenity.icon');
        });

        it('should render CheckIcon when no custom icon is provided', () => {
            expect(content).toContain('CheckIcon');
        });

        it('should use size={16} for the CheckIcon', () => {
            expect(content).toContain('size={16}');
        });

        it('should use weight="bold" for the CheckIcon', () => {
            expect(content).toContain('weight="bold"');
        });

        it('should wrap icon in aria-hidden span to hide it from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should prevent icon from shrinking with flex-shrink-0', () => {
            expect(content).toContain('flex-shrink-0');
        });
    });

    describe('Display-weight sorting', () => {
        it('should create a sorted copy instead of mutating the original array', () => {
            expect(content).toContain('[...amenities].sort');
        });

        it('should sort by displayWeight descending', () => {
            expect(content).toContain('b.displayWeight');
            expect(content).toContain('a.displayWeight');
        });

        it('should default to weight 50 when displayWeight is absent', () => {
            expect(content).toMatch(
                /b\.displayWeight\s*\?\?\s*50\)\s*-\s*\(a\.displayWeight\s*\?\?\s*50/
            );
        });

        it('should store the sorted array as sortedAmenities', () => {
            expect(content).toContain('sortedAmenities');
        });

        it('should render sortedAmenities, not the raw amenities array', () => {
            expect(content).not.toMatch(/\bamenities\.map\b/);
        });
    });

    describe('Styling tokens', () => {
        it('should use semantic color token for item text', () => {
            // New web app uses text-muted-foreground
            expect(content).toMatch(/text-muted-foreground/);
        });

        it('should use text-primary for icon color', () => {
            expect(content).toContain('text-primary');
        });
    });

    describe('Customization', () => {
        it('should accept custom CSS classes via class prop', () => {
            expect(content).toContain('className');
        });

        it('should merge custom classes using class:list', () => {
            expect(content).toContain('class:list');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic ul/li markup for the list', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('<li');
        });

        it('should have explicit role="list" on the container', () => {
            expect(content).toContain('role="list"');
        });

        it('should hide decorative icon span from assistive technology', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });
});
