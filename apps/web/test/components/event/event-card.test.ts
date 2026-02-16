import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/event/EventCard.astro');
const content = readFileSync(componentPath, 'utf8');

describe('EventCard.astro', () => {
    describe('Props', () => {
        it('should define EventCardData interface', () => {
            expect(content).toContain('interface EventCardData');
        });

        it('should accept event prop', () => {
            expect(content).toContain('event: EventCardData');
        });

        it('should accept optional locale prop', () => {
            expect(content).toContain('locale?: string');
        });

        it('should have slug property', () => {
            expect(content).toContain('slug: string');
        });

        it('should have date with start and optional end', () => {
            expect(content).toContain('date: { start: string; end?: string }');
        });

        it('should have optional location', () => {
            expect(content).toContain('location?: { name: string; city: string }');
        });
    });

    describe('Structure', () => {
        it('should use article element', () => {
            expect(content).toContain('<article');
        });

        it('should render image with alt text', () => {
            expect(content).toContain('<img');
            expect(content).toContain('alt=');
        });

        it('should use lazy loading for images', () => {
            expect(content).toContain('loading="lazy"');
        });

        it('should render name as h3', () => {
            expect(content).toContain('<h3');
        });

        it('should link to detail page via eventos route', () => {
            expect(content).toContain('/eventos/');
            expect(content).toContain('slug');
        });
    });

    describe('Content', () => {
        it('should import Badge component', () => {
            expect(content).toContain("import Badge from '../ui/Badge.astro'");
        });

        it('should display category badge', () => {
            expect(content).toContain('Badge');
            expect(content).toContain('categoryLabel');
        });

        it('should format date range', () => {
            expect(content).toContain('formatDateRange');
            expect(content).toContain('toLocaleDateString');
        });

        it('should display date with time element', () => {
            expect(content).toContain('<time');
            expect(content).toContain('datetime');
            expect(content).toContain('dateDisplay');
        });

        it('should conditionally display location', () => {
            expect(content).toContain('event.location');
            expect(content).toContain('location.name');
            expect(content).toContain('location.city');
        });

        it('should display summary with line clamp', () => {
            expect(content).toContain('line-clamp-2');
            expect(content).toContain('summary');
        });

        it('should show featured badge when applicable', () => {
            expect(content).toContain('isFeatured');
            expect(content).toContain('Destacado');
        });
    });

    describe('Date formatting', () => {
        it('should format start date using locale', () => {
            expect(content).toContain('month:');
            expect(content).toContain('day:');
        });

        it('should handle date ranges', () => {
            expect(content).toContain('startFormatted');
            expect(content).toContain('endFormatted');
        });
    });

    describe('Accessibility', () => {
        it('should hide decorative icons', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should provide alt text for event image', () => {
            expect(content).toContain('alt={event.name}');
        });
    });

    describe('Hover effects', () => {
        it('should scale image on hover', () => {
            expect(content).toContain('group-hover:scale');
        });

        it('should change shadow on hover', () => {
            expect(content).toContain('hover:shadow-lg');
        });
    });

    describe('Category mapping', () => {
        it('should define category labels', () => {
            expect(content).toContain('categoryLabels');
        });

        it('should fallback to category value if no label', () => {
            expect(content).toContain('event.category');
        });
    });
});
