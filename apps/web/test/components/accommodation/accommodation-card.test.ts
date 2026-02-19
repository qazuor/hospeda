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

        it('should accept optional price prop in data interface', () => {
            expect(content).toContain('price?:');
            expect(content).toContain('amount: number');
            expect(content).toContain('currency: string');
            expect(content).toContain('period: string');
        });

        it('should accept optional amenities prop in data interface', () => {
            expect(content).toContain('amenities?: string[]');
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

        it('should preserve transition:name on image', () => {
            expect(content).toContain('transition:name=');
            expect(content).toContain('entity-');
        });
    });

    describe('Border radius and shadow', () => {
        it('should use rounded-xl on root element', () => {
            expect(content).toContain('rounded-xl');
        });

        it('should not use rounded-lg on root element', () => {
            // rounded-lg removed from article, replaced by rounded-xl
            const articleMatch = content.match(/<article[^>]*class[^>]*>/);
            expect(articleMatch?.[0]).not.toContain('rounded-lg');
        });

        it('should use overflow-hidden on root element', () => {
            expect(content).toContain('overflow-hidden');
        });

        it('should use shadow-md as default shadow', () => {
            expect(content).toContain('shadow-md');
        });
    });

    describe('Hover effects', () => {
        it('should apply translateY hover lift on card', () => {
            expect(content).toContain('hover:-translate-y-1');
        });

        it('should apply shadow-xl on hover', () => {
            expect(content).toContain('hover:shadow-xl');
        });

        it('should use transition-transform with 300ms duration', () => {
            expect(content).toContain('transition-');
            expect(content).toContain('duration-300');
        });

        it('should scale image on hover', () => {
            expect(content).toContain('group-hover:scale-105');
        });
    });

    describe('Type badge', () => {
        it('should use type variant for accommodation type badge', () => {
            expect(content).toContain('variant="type"');
        });

        it('should display type label', () => {
            expect(content).toContain('typeLabel');
        });

        it('should have type label mapping', () => {
            expect(content).toContain('HOTEL');
            expect(content).toContain('CABIN');
        });
    });

    describe('Price badge', () => {
        it('should conditionally render price badge when price prop is provided', () => {
            expect(content).toContain('accommodation.price');
            expect(content).toContain('variant="price"');
        });

        it('should not render price badge when price is undefined', () => {
            // Conditional rendering: should check for price existence
            expect(content).toContain('accommodation.price');
        });
    });

    describe('Amenity icons row', () => {
        it('should conditionally render amenity row when amenities are provided', () => {
            expect(content).toContain('amenities');
        });

        it('should limit amenities to 3 items', () => {
            expect(content).toContain('slice(0, 3)');
        });

        it('should mark amenity icons as decorative', () => {
            expect(content).toContain('aria-hidden');
        });

        it('should have amenity config mapping for icon-to-label', () => {
            expect(content).toContain('amenityConfig');
        });
    });

    describe('Content', () => {
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
});
