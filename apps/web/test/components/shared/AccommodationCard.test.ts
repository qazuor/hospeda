/**
 * @file AccommodationCard.test.ts
 * @description Unit tests for AccommodationCard.astro component.
 * Follows Astro testing pattern: read source file and assert on content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/shared/AccommodationCard.astro'),
    'utf8'
);

describe('AccommodationCard.astro', () => {
    describe('imports', () => {
        it('should import icons from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('FavoriteIcon');
            expect(src).toContain('GalleryIcon');
            expect(src).toContain('LocationIcon');
            expect(src).toContain('StarIcon');
        });

        it('should import resolveAmenityIcon from extracted icon module', () => {
            expect(src).toContain('resolveAmenityIcon');
            expect(src).toContain("from './accommodation-card-icons'");
        });

        it('should import getAccommodationTypeColor from @/lib/colors', () => {
            expect(src).toContain("from '@/lib/colors'");
            expect(src).toContain('getAccommodationTypeColor');
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
    });

    describe('amenity icon resolver (extracted to accommodation-card-icons.ts)', () => {
        const iconsSrc = readFileSync(
            resolve(__dirname, '../../../src/components/shared/accommodation-card-icons.ts'),
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

        it('should set alt to data.name', () => {
            expect(src).toContain('alt={data.name}');
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

        it('should display city from data.location', () => {
            expect(src).toContain('data.location.city');
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

        it('should have button type attribute on favorite button', () => {
            expect(src).toContain('type="button"');
        });

        it('should have focus-visible style on card link', () => {
            expect(src).toContain('acc-card__link:focus-visible');
        });

        it('should have focus-visible style on favorite button', () => {
            expect(src).toContain('acc-card__fav-btn:focus-visible');
        });

        it('should have i18n aria-label on favorite button', () => {
            expect(src).toContain("t('ui.saveItem'");
        });
    });
});
