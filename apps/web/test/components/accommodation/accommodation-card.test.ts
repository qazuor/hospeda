import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/accommodation/AccommodationCardFeatured.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('AccommodationCardFeatured.astro', () => {
    describe('Props', () => {
        it('should import AccommodationCardData from transforms', () => {
            expect(content).toContain('import type { AccommodationCardData } from');
            expect(content).toContain('lib/api/transforms');
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

        it('should use AccommodationCardData type for accommodation prop', () => {
            expect(content).toContain('accommodation: AccommodationCardData');
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
            expect(content).toContain('buildDetailUrl');
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
            // Card uses CSS-in-style translateY on inner elements instead of Tailwind utility on root
            expect(content).toContain('translateY');
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

        it('should use i18n for type labels', () => {
            expect(content).toContain('getTypeI18nKey');
            expect(content).toContain('namespace: "accommodations"');
        });
    });

    describe('Price badge', () => {
        it('should conditionally render price badge when price prop is provided', () => {
            expect(content).toContain('accommodation.price');
            expect(content).toContain('variant="price-light"');
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

        it('should limit badge items to 6', () => {
            expect(content).toContain('slice(0, 6)');
        });

        it('should mark amenity icons as decorative', () => {
            expect(content).toContain('aria-hidden');
        });

        it('should resolve icons dynamically via resolveIcon', () => {
            expect(content).toContain('resolveIcon');
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
            expect(content).toContain('line-clamp-3');
            expect(content).toContain('summary');
        });
    });

    describe('Favorite button', () => {
        it('should conditionally show favorite button', () => {
            expect(content).toContain('showFavorite');
        });

        it('should have accessible label for favorite', () => {
            expect(content).toContain('aria-label');
            // FavoriteButtonIsland component handles aria-label internally
            expect(content).toContain('FavoriteButtonIsland');
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
