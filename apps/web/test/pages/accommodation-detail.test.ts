import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro');
const content = readFileSync(pagePath, 'utf8');

describe('[lang]/alojamientos/[slug].astro', () => {
    describe('Rendering mode', () => {
        it('should use SSR (no prerender export)', () => {
            expect(content).not.toContain('export const prerender = true');
        });

        it('should use getLocaleFromParams for runtime locale resolution', () => {
            expect(content).toContain('getLocaleFromParams');
        });
    });

    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(content).toContain('import BaseLayout from');
            expect(content).toContain('BaseLayout.astro');
        });

        it('should import SEOHead', () => {
            expect(content).toContain('import SEOHead from');
            expect(content).toContain('SEOHead.astro');
        });

        it('should import LodgingBusinessJsonLd', () => {
            expect(content).toContain('LodgingBusinessJsonLd');
        });

        it('should import Breadcrumb from shared', () => {
            expect(content).toContain('import Breadcrumb from');
            expect(content).toContain('shared/Breadcrumb.astro');
        });

        it('should import AmenitiesList from shared', () => {
            expect(content).toContain('AmenitiesList');
            expect(content).toContain('shared/AmenitiesList.astro');
        });

        it('should import AccordionFAQ', () => {
            expect(content).toContain('AccordionFAQ');
        });

        it('should import AccommodationCard from shared', () => {
            expect(content).toContain('AccommodationCard');
        });

        it('should import FavoriteButtonIsland from shared', () => {
            expect(content).toContain('FavoriteButtonIsland');
            expect(content).toContain('shared/FavoriteButtonIsland.astro');
        });

        it('should import ReviewListIsland', () => {
            expect(content).toContain('ReviewListIsland');
        });

        it('should import ImageGallery client island', () => {
            expect(content).toContain('ImageGallery');
            expect(content).toContain('ImageGallery.client');
        });

        it('should import ShareButtons client island', () => {
            expect(content).toContain('ShareButtons');
            expect(content).toContain('ShareButtons.client');
        });

        it('should import MapView client island', () => {
            expect(content).toContain('MapView');
            expect(content).toContain('MapView.client');
        });

        it('should import accommodationsApi', () => {
            expect(content).toContain('accommodationsApi');
        });

        it('should import media helpers', () => {
            expect(content).toContain('extractFeaturedImageUrl');
            expect(content).toContain('extractGalleryUrls');
        });

        it('should import tiptap renderer', () => {
            expect(content).toContain('renderTiptapContent');
        });

        it('should import sanitizeHtml', () => {
            expect(content).toContain('sanitizeHtml');
        });

        it('should import getLocaleFromParams', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain('page-helpers');
        });

        it('should import toAccommodationCardProps transform', () => {
            expect(content).toContain('toAccommodationCardProps');
        });

        it('should import createT from i18n', () => {
            expect(content).toContain('createT');
        });

        it('should import buildUrl from urls', () => {
            expect(content).toContain('buildUrl');
        });

        it('should import AccommodationPublic from @repo/schemas', () => {
            expect(content).toContain('@repo/schemas');
            expect(content).toContain('AccommodationPublic');
        });
    });

    describe('SSR data fetching', () => {
        it('should fetch accommodation by slug from API', () => {
            expect(content).toContain('accommodationsApi.getBySlug');
        });

        it('should resolve locale from Astro.params', () => {
            expect(content).toContain('Astro.params');
            expect(content).toContain('getLocaleFromParams');
        });

        it('should handle missing accommodation with redirect', () => {
            expect(content).toContain("buildUrl({ locale, path: '404' })");
            expect(content).toContain('Astro.redirect');
        });

        it('should fetch similar accommodations from API', () => {
            expect(content).toContain('accommodationsApi.list');
        });
    });

    describe('Data fetching', () => {
        it('should fetch accommodation from API by slug', () => {
            expect(content).toContain('accommodationsApi.getBySlug');
            expect(content).toContain('slug');
        });

        it('should fetch from API on every request (SSR)', () => {
            expect(content).toContain('accommodationsApi.getBySlug');
        });

        it('should redirect to 404 on API error', () => {
            expect(content).toContain("buildUrl({ locale, path: '404' })");
        });

        it('should extract featured image with placeholder fallback', () => {
            expect(content).toContain('extractFeaturedImageUrl');
            expect(content).toContain('placeholder-accommodation.svg');
        });

        it('should extract gallery URLs', () => {
            expect(content).toContain('extractGalleryUrls');
        });

        it('should build gallery images array with fallback to featured image', () => {
            expect(content).toContain('galleryImages');
            expect(content).toContain('galleryUrls.length > 0');
        });

        it('should render TipTap description with sanitization', () => {
            expect(content).toContain('renderTiptapContent');
            expect(content).toContain('sanitizeHtml');
            expect(content).toContain('descriptionHtml');
        });

        it('should fetch similar accommodations with pageSize 4', () => {
            expect(content).toContain('accommodationsApi.list({ pageSize: 4 }');
        });

        it('should map related accommodations to card props', () => {
            expect(content).toContain('relatedCards');
            expect(content).toContain('toAccommodationCardProps');
        });
    });

    describe('Amenities processing', () => {
        it('should extract amenities from nested relation structure', () => {
            expect(content).toContain('rawAmenities');
            expect(content).toContain('amenities');
        });

        it('should handle amenity slug and name fields', () => {
            expect(content).toContain('nested.slug');
            expect(content).toContain('nested.name');
        });
    });

    describe('FAQ processing', () => {
        it('should extract FAQs from accommodation data', () => {
            expect(content).toContain('rawFaqs');
            expect(content).toContain('faqs');
        });
    });

    describe('Pricing', () => {
        it('should extract price from nested price object', () => {
            expect(content).toContain('priceData');
            expect(content).toContain('priceDisplay');
        });

        it('should handle null/zero price gracefully', () => {
            expect(content).toContain('priceAmount > 0');
        });
    });

    describe('Location and map', () => {
        it('should extract lat/lng with fallbacks', () => {
            expect(content).toContain('-32.4833');
            expect(content).toContain('-58.2333');
        });

        it('should build map markers array', () => {
            expect(content).toContain('mapMarkers');
        });
    });

    describe('Template structure', () => {
        it('should render BaseLayout with accommodation name as title', () => {
            expect(content).toContain('<BaseLayout');
            expect(content).toContain('accommodation.name');
        });

        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should render LodgingBusinessJsonLd in head slot', () => {
            expect(content).toContain('<LodgingBusinessJsonLd');
            expect(content).toContain('slot="head"');
        });

        it('should render Breadcrumb', () => {
            expect(content).toContain('<Breadcrumb');
            expect(content).toContain('items={breadcrumbItems}');
        });

        it('should render ImageGallery with client:visible', () => {
            expect(content).toContain('ImageGallery');
            expect(content).toContain('client:visible');
            expect(content).toContain('images={galleryImages}');
        });

        it('should apply view transition on gallery wrapper', () => {
            expect(content).toContain('transition:name={`entity-${slug}`}');
        });

        it('should render AmenitiesList', () => {
            expect(content).toContain('<AmenitiesList');
            expect(content).toContain('amenities={amenities}');
        });

        it('should render MapView with client:visible', () => {
            expect(content).toContain('MapView');
            expect(content).toContain('client:visible');
            expect(content).toContain('markers={mapMarkers}');
        });

        it('should render ReviewListIsland', () => {
            expect(content).toContain('ReviewListIsland');
            expect(content).toContain('locale={locale}');
        });

        it('should render AccordionFAQ conditionally', () => {
            expect(content).toContain('AccordionFAQ');
            expect(content).toContain('faqs.length > 0');
        });

        it('should render FavoriteButtonIsland', () => {
            expect(content).toContain('FavoriteButtonIsland');
            expect(content).toContain('entityType="accommodation"');
        });

        it('should render ShareButtons with client:visible', () => {
            expect(content).toContain('ShareButtons');
            expect(content).toContain('client:visible');
        });

        it('should render related accommodations section', () => {
            expect(content).toContain('relatedCards');
            expect(content).toContain('<AccommodationCard');
        });

        it('should render description with set:html', () => {
            expect(content).toContain('set:html={descriptionHtml}');
            expect(content).toContain('prose');
        });

        it('should render 2-column grid layout', () => {
            expect(content).toContain('lg:grid-cols-3');
            expect(content).toContain('lg:col-span-2');
        });

        it('should render sidebar with pricing', () => {
            expect(content).toContain('priceDisplay');
            expect(content).toContain('labels.perNight');
        });

        it('should render check-in and check-out times', () => {
            expect(content).toContain('checkInTime');
            expect(content).toContain('checkOutTime');
        });

        it('should render contact CTA button', () => {
            expect(content).toContain('labels.inquire');
        });
    });

    describe('i18n', () => {
        it('should use locale from params', () => {
            expect(content).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(content).toContain("Astro.redirect('/es/')");
        });

        it('should use createT for translations', () => {
            expect(content).toContain('createT(locale)');
        });

        it('should translate section labels', () => {
            expect(content).toContain('accommodations.detail.description');
            expect(content).toContain('accommodations.detail.amenities');
        });
    });

    describe('JSON-LD address', () => {
        it('should build address with country AR', () => {
            expect(content).toContain("addressCountry: 'AR'");
        });
    });
});
