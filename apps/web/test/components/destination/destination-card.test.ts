import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/destination/DestinationCard.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('DestinationCard.astro', () => {
    describe('Props', () => {
        it('should define DestinationCardData interface', () => {
            expect(content).toContain('interface DestinationCardData');
        });

        it('should accept destination prop', () => {
            expect(content).toContain('destination: DestinationCardData');
        });

        it('should accept optional locale prop', () => {
            expect(content).toContain('locale?: string');
        });

        it('should support optional path for hierarchy', () => {
            expect(content).toContain('path?: string');
        });
    });

    describe('Border radius and shadow', () => {
        it('should use rounded-xl on root element', () => {
            expect(content).toContain('rounded-xl');
        });

        it('should use shadow-lg as default shadow', () => {
            const articleMatch = content.match(/<article[^>]*class[^>]*>/);
            expect(articleMatch?.[0]).toContain('shadow-lg');
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

    describe('Full-bleed image layout', () => {
        it('should render gradient overlay on image', () => {
            expect(content).toContain('from-black/70');
        });

        it('should use absolute positioning for gradient overlay', () => {
            expect(content).toContain('inset-0');
            expect(content).toContain('bg-gradient-to-t');
        });

        it('should overlay name text on the image', () => {
            // Name should be inside the image container, not a separate content div
            expect(content).toContain('text-white');
            expect(content).toContain('font-bold');
        });

        it('should overlay accommodation count on image with reduced opacity', () => {
            expect(content).toContain('text-white/80');
        });

        it('should NOT have a separate content div below image', () => {
            // The old <div class="p-4"> content block should be removed
            // Name and count are now overlaid on the image
            const contentDivCount = (content.match(/<div class="p-4">/g) || []).length;
            expect(contentDivCount).toBe(0);
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

        it('should use lazy loading', () => {
            expect(content).toContain('loading="lazy"');
        });

        it('should preserve transition:name on image', () => {
            expect(content).toContain('transition:name=');
            expect(content).toContain('entity-');
        });

        it('should link to detail page via destinos route', () => {
            expect(content).toContain('/destinos/');
        });
    });

    describe('Content', () => {
        it('should display accommodations count', () => {
            expect(content).toContain('accommodationsCount');
            expect(content).toContain('alojamiento');
        });

        it('should show featured badge when applicable', () => {
            expect(content).toContain('isFeatured');
            expect(content).toContain('Destacado');
        });
    });

    describe('URL resolution', () => {
        it('should prefer path over slug for URL', () => {
            expect(content).toContain('destination.path');
            expect(content).toContain('destination.slug');
        });
    });

    describe('Accessibility', () => {
        it('should hide decorative icons', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });
});
