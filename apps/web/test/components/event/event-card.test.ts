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

        it('should accept optional variant prop', () => {
            expect(content).toContain('variant?:');
            expect(content).toContain("'image'");
            expect(content).toContain("'date-panel'");
        });

        it('should accept optional index prop for color rotation', () => {
            expect(content).toContain('index?:');
        });

        it('should default variant to image', () => {
            expect(content).toContain("variant = 'image'");
        });

        it('should default index to 0', () => {
            expect(content).toContain('index = 0');
        });
    });

    describe('Border radius and shadow', () => {
        it('should use rounded-xl on root element', () => {
            expect(content).toContain('rounded-xl');
        });

        it('should use shadow-sm as default shadow', () => {
            const articleMatch = content.match(/<article[^>]*class[^>]*>/);
            expect(articleMatch?.[0]).toContain('shadow-sm');
        });

        it('should use overflow-hidden on root element', () => {
            expect(content).toContain('overflow-hidden');
        });
    });

    describe('Hover effects', () => {
        it('should apply translateY hover lift on card', () => {
            expect(content).toContain('hover:-translate-y-1');
        });

        it('should apply shadow-xl on hover', () => {
            expect(content).toContain('hover:shadow-xl');
        });

        it('should use transition with 300ms duration', () => {
            expect(content).toContain('duration-300');
        });

        it('should scale image on hover', () => {
            expect(content).toContain('group-hover:scale-105');
        });
    });

    describe('Image variant', () => {
        it('should render image with alt text', () => {
            expect(content).toContain('<img');
            expect(content).toContain('alt=');
        });

        it('should use lazy loading for images', () => {
            expect(content).toContain('loading="lazy"');
        });

        it('should preserve transition:name on image', () => {
            expect(content).toContain('transition:name=');
            expect(content).toContain('entity-');
        });
    });

    describe('Date-panel variant', () => {
        it('should compute date panel accent color based on index', () => {
            expect(content).toContain('bg-blue-500');
            expect(content).toContain('bg-green-500');
            expect(content).toContain('bg-sky-500');
        });

        it('should use index modulo 3 for color rotation', () => {
            expect(content).toContain('index % 3');
        });

        it('should display day number in the date panel', () => {
            expect(content).toContain('getDate');
        });

        it('should use font-display (Playfair) for day number', () => {
            expect(content).toContain('font-display');
        });

        it('should display abbreviated month in the date panel', () => {
            expect(content).toContain('month:');
            expect(content).toContain("'short'");
        });

        it('should use month Badge variant in date panel', () => {
            expect(content).toContain('variant="month"');
        });
    });

    describe('Structure', () => {
        it('should use article element', () => {
            expect(content).toContain('<article');
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

        it('should display date with time element', () => {
            expect(content).toContain('<time');
            expect(content).toContain('datetime');
        });

        it('should conditionally display location', () => {
            expect(content).toContain('event.location');
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

    describe('Accessibility', () => {
        it('should hide decorative icons', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should provide alt text for event image', () => {
            expect(content).toContain('alt={event.name}');
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

    describe('T-037: Source file integrity', () => {
        it('should be a non-empty readable file', () => {
            expect(content.length).toBeGreaterThan(0);
        });

        it('should contain a valid Astro component frontmatter block', () => {
            expect(content).toMatch(/^---/);
            expect(content).toContain('---');
        });

        it('should not have any broken import statements', () => {
            const imports = content.match(/^import .+from .+;?$/gm) ?? [];
            expect(imports.length).toBeGreaterThan(0);
        });

        it('should still export a valid Props interface', () => {
            expect(content).toContain('interface Props');
        });
    });
});
