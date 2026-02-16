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

        it('should render name as h3', () => {
            expect(content).toContain('<h3');
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

        it('should display summary with line clamp', () => {
            expect(content).toContain('line-clamp-2');
            expect(content).toContain('summary');
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

    describe('Hover effects', () => {
        it('should scale image on hover', () => {
            expect(content).toContain('group-hover:scale');
        });

        it('should change shadow on hover', () => {
            expect(content).toContain('hover:shadow-lg');
        });
    });
});
