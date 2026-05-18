/**
 * @file AccommodationCard.test.ts
 * @description Unit tests for AccommodationCard.astro component.
 * Follows Astro testing pattern: read source file and assert on content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/AccommodationCard.astro'),
    'utf8'
);

describe('AccommodationCard.astro', () => {
    describe('imports', () => {
        it('should import FavoriteButton island from shared/favorite', () => {
            expect(src).toContain("from '@/components/shared/favorite/FavoriteButton.client'");
            expect(src).toContain('FavoriteButton');
        });

        it('should NOT import FavoriteIcon directly (delegated to FavoriteButton island)', () => {
            // FavoriteIcon is now rendered internally by FavoriteButton — the card
            // should not import it to avoid shipping a duplicate icon bundle.
            expect(src).not.toContain('FavoriteIcon');
        });

        it('should import GalleryIcon, LocationIcon and StarIcon from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('GalleryIcon');
            expect(src).toContain('LocationIcon');
            expect(src).toContain('StarIcon');
        });

        it('should import resolveAmenityIcon from extracted icon module', () => {
            expect(src).toContain('resolveAmenityIcon');
            expect(src).toContain("from './accommodation-card-icons'");
        });

        it('should bake "new" and "featured" badge colors into scoped CSS (no inline style=, SPEC-046)', () => {
            // SPEC-046 GAP-046-09a: the badge colors are constants (status='new' /
            // status='featured' from getBadgeStatusColor) so we hard-code them in
            // the scoped <style> instead of threading via inline style= attributes.
            expect(src).toContain('var(--hospeda-forest)');
            expect(src).toContain('var(--brand-accent)');
            expect(src).not.toContain('getBadgeStatusColor');
        });

        it('should import the shared AccommodationTypeBadge', () => {
            expect(src).toContain("from '@/components/shared/ui/AccommodationTypeBadge.astro'");
        });

        it('should not import the per-type colour helpers (delegated to the badge)', () => {
            expect(src).not.toContain('getAccommodationTypeColor');
            expect(src).not.toContain('getAccommodationTypeLabel');
        });

        it('should import formatPrice from @/lib/format-utils', () => {
            expect(src).toContain("from '@/lib/format-utils'");
            expect(src).toContain('formatPrice');
        });

        it('should import buildUrl from @/lib/urls', () => {
            expect(src).toContain("from '@/lib/urls'");
            expect(src).toContain('buildUrl');
        });

        it('should import AccommodationCardData type', () => {
            expect(src).toContain('AccommodationCardData');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props interface', () => {
        it('should define Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('should declare data prop as readonly AccommodationCardData', () => {
            expect(src).toContain('readonly data: AccommodationCardData');
        });

        it('should declare locale prop as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('should declare optional isAuthenticated prop', () => {
            expect(src).toContain('readonly isAuthenticated?: boolean');
        });

        it('should default isAuthenticated to false', () => {
            expect(src).toContain('isAuthenticated = false');
        });
    });

    describe('FavoriteButton island integration (SPEC-098)', () => {
        it('should render FavoriteButton with client:visible directive', () => {
            // Defer hydration until the card scrolls into view to keep the
            // initial JS payload small on listing pages with many cards.
            expect(src).toContain('client:visible');
            expect(src).not.toContain('client:load');
        });

        it('should pass entityId from data.id', () => {
            expect(src).toContain('entityId={data.id}');
        });

        it('should pass entityType="ACCOMMODATION"', () => {
            expect(src).toContain('entityType="ACCOMMODATION"');
        });

        it('should pass initialIsFavorited from data.isFavorited', () => {
            expect(src).toContain('initialIsFavorited={data.isFavorited}');
        });

        it('should pass initialBookmarkId from data.favoriteBookmarkId with null fallback', () => {
            expect(src).toContain('initialBookmarkId={data.favoriteBookmarkId ?? null}');
        });

        it('should pass count from data.bookmarkCount', () => {
            expect(src).toContain('count={data.bookmarkCount}');
        });

        it('should use standalone variant', () => {
            expect(src).toContain('variant="standalone"');
        });

        it('should forward locale to FavoriteButton', () => {
            expect(src).toContain('locale={locale}');
        });

        it('should forward isAuthenticated to FavoriteButton', () => {
            expect(src).toContain('isAuthenticated={isAuthenticated}');
        });
    });

    describe('amenity icon resolver (extracted to accommodation-card-icons.ts)', () => {
        const iconsSrc = readFileSync(
            resolve(
                __dirname,
                '../../../../src/components/shared/cards/accommodation-card-icons.ts'
            ),
            'utf8'
        );

        it('should import resolveAmenityIcon in the card', () => {
            expect(src).toContain('resolveAmenityIcon');
        });

        it('should map WifiHigh to WifiHighIcon', () => {
            expect(iconsSrc).toContain('WifiHigh: WifiHighIcon');
        });

        it('should map Waves to PoolIcon', () => {
            expect(iconsSrc).toContain('Waves: PoolIcon');
        });

        it('should map Car to CarIcon', () => {
            expect(iconsSrc).toContain('Car: CarIcon');
        });

        it('should map FireSimple to BbqGrillIcon', () => {
            expect(iconsSrc).toContain('FireSimple: BbqGrillIcon');
        });

        it('should have a fallback icon (WifiIcon)', () => {
            expect(iconsSrc).toContain('?? WifiIcon');
        });

        it('should use a MAX_AMENITIES constant limiting to 4', () => {
            expect(src).toContain('MAX_AMENITIES = 4');
        });

        it('should render dynamic amenity icons from data.amenities', () => {
            expect(src).toContain('visibleAmenities');
            expect(src).toContain('visibleAmenities.map');
        });

        it('should show +N label when more amenities exist', () => {
            expect(src).toContain('extraAmenities');
            expect(src).toContain('+{extraAmenities}');
        });
    });

    describe('semantic structure', () => {
        it('should render an <article> element', () => {
            expect(src).toContain('<article');
        });

        it('should render an <img> element', () => {
            expect(src).toContain('<img');
        });

        it('should render an <h3> for the accommodation name', () => {
            expect(src).toContain('<h3');
        });
    });

    describe('image', () => {
        it('should use loading="lazy" on the card image', () => {
            expect(src).toContain('loading="lazy"');
        });

        it('should prefer caption over name as alt text (caption wins when present)', () => {
            // Caption from API media.featuredImage.caption is used first; name is the fallback.
            expect(src).toContain('data.featuredImage.caption ?? data.name');
        });

        it('should use data.featuredImage.url as the image src', () => {
            expect(src).toContain('data.featuredImage.url');
        });

        it('should have width and height on the card image', () => {
            expect(src).toContain('width="432"');
            expect(src).toContain('height="220"');
        });
    });

    describe('featured badge', () => {
        it('should conditionally render a status corner when isFeatured is true', () => {
            expect(src).toContain('data.isFeatured');
            expect(src).toContain('acc-card__status-corner');
        });
    });

    describe('content', () => {
        it('should use font-heading for the accommodation name', () => {
            expect(src).toContain('font-heading');
        });

        it('should render LocationIcon for location', () => {
            expect(src).toContain('LocationIcon');
        });

        it('should prefer cityName from cityDestination over legacy location.city (SPEC-095)', () => {
            expect(src).toContain('data.cityName ?? data.location.city');
        });

        it('should conditionally render price when formattedPrice exists', () => {
            expect(src).toContain('formattedPrice');
        });

        it('should render star rating icons', () => {
            expect(src).toContain('StarIcon');
            expect(src).toContain('fullStars');
        });

        it('should display reviewsCount', () => {
            expect(src).toContain('data.reviewsCount');
        });
    });

    describe('URL building', () => {
        it('should build detail URL with /alojamientos/ path and slug', () => {
            expect(src).toContain('/alojamientos/');
            expect(src).toContain('data.slug');
        });

        it('should link the card to the detail page', () => {
            expect(src).toContain('href={detailUrl}');
        });
    });

    describe('accessibility', () => {
        it('should mark decorative icons as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should have focus-visible style on card link', () => {
            expect(src).toContain('acc-card__link:focus-visible');
        });

        it('should retain focus-visible CSS for the old fav-btn class (layout stability)', () => {
            // The .acc-card__fav-btn:focus-visible rule is kept in CSS for graceful
            // degradation even though the static button is replaced by FavoriteButton.
            expect(src).toContain('acc-card__fav-btn:focus-visible');
        });
    });
});
