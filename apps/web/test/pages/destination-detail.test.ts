import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/destinos/[...path].astro');
const content = readFileSync(pagePath, 'utf8');

describe('[lang]/destinos/[...path].astro', () => {
    describe('Rendering mode', () => {
        it('should export prerender = true for SSG', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should export getStaticPaths function', () => {
            expect(content).toContain('export async function getStaticPaths');
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

        it('should import PlaceJsonLd from seo', () => {
            expect(content).toContain('PlaceJsonLd');
            expect(content).toContain('seo/PlaceJsonLd.astro');
        });

        it('should import Breadcrumb from shared', () => {
            expect(content).toContain('import Breadcrumb from');
            expect(content).toContain('shared/Breadcrumb.astro');
        });

        it('should import AccommodationCard from shared', () => {
            expect(content).toContain('import AccommodationCard from');
            expect(content).toContain('shared/AccommodationCard.astro');
        });

        it('should import EventCard from shared', () => {
            expect(content).toContain('import EventCard from');
            expect(content).toContain('shared/EventCard.astro');
        });

        it('should import EmptyState from shared', () => {
            expect(content).toContain('import EmptyState from');
            expect(content).toContain('shared/EmptyState.astro');
        });

        it('should import FavoriteButtonIsland from shared', () => {
            expect(content).toContain('FavoriteButtonIsland');
            expect(content).toContain('shared/FavoriteButtonIsland.astro');
        });

        it('should import ImageGallery client island from shared', () => {
            expect(content).toContain('ImageGallery');
            expect(content).toContain('shared/ImageGallery.client');
        });

        it('should import ShareButtons client island from shared', () => {
            expect(content).toContain('ShareButtons');
            expect(content).toContain('shared/ShareButtons.client');
        });

        it('should import MapView client island from shared', () => {
            expect(content).toContain('MapView');
            expect(content).toContain('shared/MapView.client');
        });

        it('should import createTranslations from i18n', () => {
            expect(content).toContain('createTranslations');
            expect(content).toContain('SUPPORTED_LOCALES');
        });

        it('should import buildUrl and buildUrlWithParams from urls', () => {
            expect(content).toContain('buildUrl');
            expect(content).toContain('buildUrlWithParams');
        });

        it('should import destinationsApi and eventsApi', () => {
            expect(content).toContain('destinationsApi');
            expect(content).toContain('eventsApi');
        });

        it('should import fetchAllPages from api client', () => {
            expect(content).toContain('fetchAllPages');
            expect(content).toContain("from '../../../lib/api/client'");
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

        it('should import toAccommodationCardProps and toEventCardProps', () => {
            expect(content).toContain('toAccommodationCardProps');
            expect(content).toContain('toEventCardProps');
        });
    });

    describe('getStaticPaths', () => {
        it('should use SUPPORTED_LOCALES', () => {
            expect(content).toContain('SUPPORTED_LOCALES');
        });

        it('should fetch all destination pages with fetchAllPages', () => {
            expect(content).toContain('fetchAllPages');
            expect(content).toContain('destinationsApi.list');
        });

        it('should filter destinations by path or slug', () => {
            expect(content).toContain('d.path || d.slug');
        });

        it('should return lang and path params', () => {
            expect(content).toContain('params: { lang, path:');
        });

        it('should strip leading slash from path', () => {
            expect(content).toContain(".replace(/^\\//, '')");
        });

        it('should pass destinationData as props', () => {
            expect(content).toContain('props: { destinationData: d }');
        });
    });

    describe('Data fetching', () => {
        it('should use destinationData from getStaticPaths props', () => {
            expect(content).toContain('destinationData');
            expect(content).toContain('Astro.props');
        });

        it('should fetch destination by path on SSR fallback', () => {
            expect(content).toContain('destinationsApi.getByPath');
        });

        it('should redirect on API error without fallback data', () => {
            expect(content).toContain('destinos');
            expect(content).toContain('Astro.redirect');
        });

        it('should use Promise.all for parallel fetching', () => {
            expect(content).toContain('Promise.all');
        });

        it('should fetch accommodations via destinationsApi.getAccommodations', () => {
            expect(content).toContain('destinationsApi.getAccommodations');
        });

        it('should fetch events and filter by destination city', () => {
            expect(content).toContain('eventsApi.list');
            expect(content).toContain('destinationName.toLowerCase()');
        });

        it('should fetch breadcrumb hierarchy', () => {
            expect(content).toContain('destinationsApi.getBreadcrumb');
        });

        it('should render TipTap description with toTiptapDoc helper', () => {
            expect(content).toContain('toTiptapDoc');
            expect(content).toContain('renderTiptapContent');
            expect(content).toContain('descriptionHtml');
        });

        it('should render howToGetThere content', () => {
            expect(content).toContain('howToGetThereHtml');
        });

        it('should extract featured image with placeholder fallback', () => {
            expect(content).toContain('extractFeaturedImageUrl');
            expect(content).toContain('placeholder-destination.svg');
        });

        it('should build gallery images array', () => {
            expect(content).toContain('galleryImages');
            expect(content).toContain('galleryUrls.length > 0');
            expect(content).toContain('extractGalleryUrls');
        });
    });

    describe('Climate fields', () => {
        it('should define climateFields array', () => {
            expect(content).toContain('climateFields');
        });

        it('should include summer, winter, bestSeason, rainfall', () => {
            expect(content).toContain("'summer'");
            expect(content).toContain("'winter'");
            expect(content).toContain("'bestSeason'");
            expect(content).toContain("'rainfall'");
        });

        it('should filter out empty climate values', () => {
            expect(content).toContain('.filter((f) => Boolean(f.value))');
        });
    });

    describe('Preview limit', () => {
        it('should define PREVIEW_LIMIT constant', () => {
            expect(content).toContain('PREVIEW_LIMIT');
            expect(content).toContain('3 as const');
        });

        it('should slice accommodations to preview limit', () => {
            expect(content).toContain('previewAccs');
            expect(content).toContain('.slice(0, PREVIEW_LIMIT)');
        });

        it('should slice events to preview limit', () => {
            expect(content).toContain('previewEvts');
        });
    });

    describe('Template structure', () => {
        it('should render BaseLayout with destination name as title', () => {
            expect(content).toContain('<BaseLayout');
            expect(content).toContain('title={destinationName}');
        });

        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should render PlaceJsonLd in head slot with addressCountry AR', () => {
            expect(content).toContain('<PlaceJsonLd');
            expect(content).toContain('slot="head"');
            expect(content).toContain("addressCountry: 'AR'");
        });

        it('should render Breadcrumb with items', () => {
            expect(content).toContain('<Breadcrumb');
            expect(content).toContain('breadcrumbItems');
        });

        it('should render hero with aspect-[21/9]', () => {
            expect(content).toContain('aspect-[21/9]');
        });

        it('should apply view transition on hero image', () => {
            expect(content).toContain('transition:name={`entity-${destinationSlug}`}');
        });

        it('should render province badge in hero', () => {
            expect(content).toContain('destinationProvince');
        });

        it('should render FavoriteButtonIsland with server:defer', () => {
            expect(content).toContain('FavoriteButtonIsland');
            expect(content).toContain('server:defer');
            expect(content).toContain('entityType="destination"');
        });

        it('should render ShareButtons with client:visible', () => {
            expect(content).toContain('ShareButtons');
            expect(content).toContain('client:visible');
        });

        it('should render 2/3 + 1/3 grid layout', () => {
            expect(content).toContain('lg:grid-cols-3');
            expect(content).toContain('lg:col-span-2');
        });

        it('should render description with set:html', () => {
            expect(content).toContain('set:html={descriptionHtml}');
            expect(content).toContain('prose');
        });

        it('should render ImageGallery with client:visible', () => {
            expect(content).toContain('ImageGallery');
            expect(content).toContain('client:visible');
            expect(content).toContain('images={galleryImages}');
        });

        it('should render climate grid section', () => {
            expect(content).toContain('climateFields');
            expect(content).toContain('climateFields.length > 0');
        });

        it('should render howToGetThere with set:html', () => {
            expect(content).toContain('set:html={howToGetThereHtml}');
        });

        it('should render attractions list', () => {
            expect(content).toContain('attractions');
            expect(content).toContain('a.name');
            expect(content).toContain('a.description');
        });

        it('should render MapView with client:visible', () => {
            expect(content).toContain('MapView');
            expect(content).toContain('client:visible');
            expect(content).toContain('markers={mapMarkers}');
        });

        it('should render sidebar with accommodation count', () => {
            expect(content).toContain('accommodationCount');
            expect(content).toContain('accsUrl');
        });

        it('should render sidebar with event count', () => {
            expect(content).toContain('eventCount');
            expect(content).toContain('eventsUrl');
        });

        it('should render accommodations preview grid below the fold', () => {
            expect(content).toContain('<AccommodationCard');
            expect(content).toContain('previewAccs');
        });

        it('should render events preview grid below the fold', () => {
            expect(content).toContain('<EventCard');
            expect(content).toContain('previewEvts');
        });

        it('should render EmptyState for no accommodations', () => {
            expect(content).toContain("'destination.detail.noAccommodations'");
        });

        it('should render EmptyState for no events', () => {
            expect(content).toContain("'destination.detail.noEvents'");
        });
    });

    describe('i18n', () => {
        it('should use locale from params', () => {
            expect(content).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(content).toContain("Astro.redirect('/es/')");
        });

        it('should use createTranslations (not createT)', () => {
            expect(content).toContain('createTranslations(locale)');
        });

        it('should destructure t and tPlural from createTranslations', () => {
            expect(content).toContain('{ t, tPlural }');
        });

        it('should use HOME_BREADCRUMB for breadcrumb home label', () => {
            expect(content).toContain('HOME_BREADCRUMB[locale]');
        });
    });

    describe('Map markers', () => {
        it('should only create markers when lat and lng exist', () => {
            expect(content).toContain('locationCoords.lat');
            expect(content).toContain('locationCoords.lng');
        });

        it('should build mapMarkers array', () => {
            expect(content).toContain('mapMarkers');
        });
    });

    describe('Canonical URL', () => {
        it('should build canonical URL from Astro.site', () => {
            expect(content).toContain('canonicalUrl');
            expect(content).toContain('Astro.site');
        });
    });
});
