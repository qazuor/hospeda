import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/accommodation/AccommodationCard.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('AccommodationCard.astro', () => {
    describe('Props', () => {
        it('should define AccommodationCardData interface', () => {
            expect(content).toContain('interface AccommodationCardData');
        });

        it('should accept accommodation prop', () => {
            expect(content).toContain('accommodation: AccommodationCardData');
        });

        it('should accept optional showFavorite prop', () => {
            expect(content).toContain('showFavorite?: boolean');
        });

        it('should accept optional locale prop', () => {
            expect(content).toContain('locale?: string');
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

        it('should link to detail page', () => {
            expect(content).toContain('/alojamientos/');
            expect(content).toContain('slug');
        });
    });

    describe('Content', () => {
        it('should display accommodation type badge', () => {
            expect(content).toContain('Badge');
            expect(content).toContain('typeLabel');
        });

        it('should display rating', () => {
            expect(content).toContain('formattedRating');
            expect(content).toContain('averageRating');
        });

        it('should display location', () => {
            expect(content).toContain('location?.city');
            expect(content).toContain('location?.state');
        });

        it('should display summary with line clamp', () => {
            expect(content).toContain('line-clamp-2');
            expect(content).toContain('summary');
        });
    });

    describe('Favorite button', () => {
        it('should conditionally show favorite button', () => {
            expect(content).toContain('showFavorite');
        });

        it('should have accessible label for favorite', () => {
            expect(content).toContain('aria-label');
            expect(content).toContain('favorites');
        });
    });

    describe('Accessibility', () => {
        it('should have rating aria-label', () => {
            expect(content).toContain('aria-label');
            expect(content).toContain('Rating');
        });

        it('should hide decorative icons', () => {
            expect(content).toContain('aria-hidden="true"');
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
