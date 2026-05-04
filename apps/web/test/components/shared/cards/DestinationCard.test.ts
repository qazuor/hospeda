/**
 * @file DestinationCard.test.ts
 * @description Unit tests for DestinationCard.astro component.
 * Follows the Astro testing pattern: read source file and assert on content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/DestinationCard.astro'),
    'utf8'
);

describe('DestinationCard.astro', () => {
    describe('imports', () => {
        it('should import FavoriteButton island from shared/favorite', () => {
            expect(src).toContain("from '@/components/shared/favorite/FavoriteButton.client'");
            expect(src).toContain('FavoriteButton');
        });

        it('should import DestinationRating component', () => {
            expect(src).toContain("from '@/components/shared/cards/DestinationRating.astro'");
            expect(src).toContain('DestinationRating');
        });

        it('should import buildUrl from @/lib/urls', () => {
            expect(src).toContain("from '@/lib/urls'");
            expect(src).toContain('buildUrl');
        });

        it('should import createTranslations from @/lib/i18n', () => {
            expect(src).toContain("from '@/lib/i18n'");
            expect(src).toContain('createTranslations');
        });

        it('should import Image from astro:assets', () => {
            expect(src).toContain("from 'astro:assets'");
            expect(src).toContain('Image');
        });

        it('should import DestinationCardData type', () => {
            expect(src).toContain('DestinationCardData');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props interface', () => {
        it('should define a Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('should declare destination prop as readonly DestinationCardData', () => {
            expect(src).toContain('readonly destination: DestinationCardData');
        });

        it('should declare locale prop as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('should declare variant prop as optional DestinationCardVariant', () => {
            expect(src).toContain('readonly variant?: DestinationCardVariant');
        });

        it('should declare isAuthenticated prop as optional boolean', () => {
            expect(src).toContain('readonly isAuthenticated?: boolean');
        });
    });

    describe('variant support', () => {
        it('should export DestinationCardVariant type with grid and carousel values', () => {
            expect(src).toContain("'grid' | 'carousel'");
        });

        it('should apply variant-specific CSS classes', () => {
            expect(src).toContain('dest-card--${variant}');
        });

        it('should render the wave separator only for grid variant', () => {
            expect(src).toContain("variant === 'grid'");
            expect(src).toContain('dest-card__wave');
        });

        it('should render overlay content only for carousel variant', () => {
            expect(src).toContain("variant === 'carousel'");
            expect(src).toContain('dest-card__overlay-content');
        });
    });

    describe('semantic structure', () => {
        it('should render an <article> element', () => {
            expect(src).toContain('<article');
        });

        it('should render an <img> element for external images', () => {
            expect(src).toContain('<img');
        });

        it('should render an <h3> for the destination name', () => {
            expect(src).toContain('<h3');
        });
    });

    describe('image handling', () => {
        it('should use loading="lazy" on images', () => {
            expect(src).toContain('loading="lazy"');
        });

        it('should prefer caption over name as alt text', () => {
            expect(src).toContain('destination.featuredImage.caption ?? destination.name');
        });

        it('should use destination.featuredImage.url as src', () => {
            expect(src).toContain('destination.featuredImage.url');
        });

        it('should detect external images for conditional rendering', () => {
            expect(src).toContain('isExternalImage');
            expect(src).toContain("startsWith('http')");
        });

        it('should include a data-fallback attribute for broken images', () => {
            expect(src).toContain('data-fallback');
            expect(src).toContain('placeholder-destination.svg');
        });

        it('should use transition:name for view transitions', () => {
            expect(src).toContain('transition:name={`destination-${destination.slug}`}');
        });
    });

    describe('FavoriteButton island', () => {
        it('should use client:visible hydration directive', () => {
            // Defer hydration until the card scrolls into view to keep the
            // initial JS payload small on listing pages with many cards.
            expect(src).toContain('client:visible');
            expect(src).not.toContain('client:load');
        });

        it('should pass entityType="DESTINATION" to FavoriteButton', () => {
            expect(src).toContain('entityType="DESTINATION"');
        });

        it('should pass entityId from destination.id (UUID, not slug)', () => {
            // T-DC2: entityId must be the UUID so the bookmark service stores the
            // correct polymorphic foreign key. Using destination.slug was a T-DC1
            // placeholder that is now fixed.
            expect(src).toContain('entityId={destination.id}');
            expect(src).not.toContain('entityId={destination.slug}');
        });

        it('should forward isAuthenticated prop to FavoriteButton', () => {
            expect(src).toContain('isAuthenticated={isAuthenticated}');
        });

        it('should pass locale to FavoriteButton', () => {
            expect(src).toContain('locale={locale}');
        });

        it('should place the FavoriteButton in the top-right actions area', () => {
            expect(src).toContain('dest-card__actions');
        });
    });

    describe('content', () => {
        it('should use font-heading for the destination name', () => {
            expect(src).toContain('font-heading');
        });

        it('should display accommodationsCount', () => {
            expect(src).toContain('destination.accommodationsCount');
        });

        it('should display summary / description', () => {
            expect(src).toContain('destination.summary');
        });

        it('should render the DestinationRating component when averageRating > 0', () => {
            // Star rendering and reviews-count formatting live in DestinationRating.
            // The card just delegates with the right props.
            expect(src).toContain('<DestinationRating');
            expect(src).toContain('averageRating={destination.averageRating}');
            expect(src).toContain('reviewsCount={destination.reviewsCount}');
        });

        it('should pass onDark={true} to DestinationRating in the carousel overlay', () => {
            expect(src).toContain('onDark={true}');
        });

        it('should render the CTA button in grid variant', () => {
            expect(src).toContain('dest-card__cta-btn');
        });

        it('should conditionally render the featured badge', () => {
            expect(src).toContain('destination.isFeatured');
            expect(src).toContain('dest-card__featured-badge');
        });
    });

    describe('URL building', () => {
        it('should build detail URL with /destinos/ path and slug', () => {
            expect(src).toContain('destinos/${destination.slug}');
        });

        it('should link the card to the destination detail page', () => {
            expect(src).toContain('href={detailUrl}');
        });
    });

    describe('i18n', () => {
        it('should use createTranslations for text labels', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for accommodation count singular/plural labels', () => {
            expect(src).toContain("t('destination.card.accommodation_singular'");
            expect(src).toContain("t('destination.card.accommodation_plural'");
        });

        it('should use t() for CTA label', () => {
            expect(src).toContain("t('destination.card.cta'");
        });
    });

    describe('accessibility', () => {
        it('should mark decorative elements as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should have a focus-visible style on the card link', () => {
            expect(src).toContain('dest-card__link:focus-visible');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties for colors (no hardcoded values)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should apply variant-specific class via template literal', () => {
            // The class is composed dynamically: `dest-card dest-card--${variant}`
            expect(src).toContain('dest-card dest-card--${variant}');
        });

        it('should have carousel-specific CSS rules', () => {
            expect(src).toContain('.dest-card--carousel');
        });

        it('should have a gradient overlay element', () => {
            expect(src).toContain('dest-card__gradient');
        });

        it('should use transition for hover effects on image', () => {
            expect(src).toContain('transform: scale(');
        });
    });
});
