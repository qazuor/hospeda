/**
 * Tests for Destination Detail Page
 *
 * Validates structure, props, components, and localization
 * for the destination detail page at /[lang]/destinos/[...path]
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/destinos/[...path].astro');
const content = readFileSync(pagePath, 'utf8');

describe('Destination Detail Page', () => {
    describe('Component Imports', () => {
        it('should import BaseLayout from layouts', () => {
            expect(content).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
        });

        it('should import Container component', () => {
            expect(content).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
        });

        it('should import Section component', () => {
            expect(content).toContain("import Section from '../../../components/ui/Section.astro'");
        });

        it('should import Badge component', () => {
            expect(content).toContain("import Badge from '../../../components/ui/Badge.astro'");
        });

        it('should import Breadcrumb component', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
        });

        it('should import SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import AccommodationCardFeatured component', () => {
            expect(content).toContain(
                "import AccommodationCardFeatured from '../../../components/accommodation/AccommodationCardFeatured.astro'"
            );
        });

        it('should import EventCard component', () => {
            expect(content).toContain(
                "import EventCard from '../../../components/event/EventCard.astro'"
            );
        });

        it('should import EmptyState component', () => {
            expect(content).toContain(
                "import EmptyState from '../../../components/ui/EmptyState.astro'"
            );
        });

        it('should import ImageGallery client component', () => {
            expect(content).toContain(
                "import { ImageGallery } from '../../../components/ui/ImageGallery.client.tsx'"
            );
        });

        it('should import ShareButtons client component', () => {
            expect(content).toContain(
                "import { ShareButtons } from '../../../components/ui/ShareButtons.client.tsx'"
            );
        });

        it('should import FavoriteButtonIsland server island', () => {
            expect(content).toContain(
                "import FavoriteButtonIsland from '../../../components/ui/FavoriteButtonIsland.astro'"
            );
        });

        it('should import MapView client component', () => {
            expect(content).toContain(
                "import { MapView } from '../../../components/map/MapView.client.tsx'"
            );
        });

        it('should import i18n utilities from page-helpers', () => {
            expect(content).toContain("from '../../../lib/page-helpers'");
            expect(content).toContain('getLocaleFromParams');
        });

        it('should import t from i18n lib', () => {
            expect(content).toContain("import { t as i18nT } from '../../../lib/i18n'");
        });

        it('should import TipTap renderer', () => {
            expect(content).toContain(
                "import { renderTiptapContent } from '../../../lib/tiptap-renderer'"
            );
        });

        it('should import API endpoints', () => {
            expect(content).toContain(
                "import { destinationsApi, accommodationsApi, eventsApi } from '../../../lib/api/endpoints'"
            );
        });
    });

    describe('Route Parameters', () => {
        it('should use catch-all path parameter', () => {
            expect(content).toContain('const { path } = Astro.params');
        });
    });

    describe('Locale Validation', () => {
        it('should validate locale with getLocaleFromParams', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
            expect(content).toContain('if (!locale)');
        });

        it('should redirect to default locale if invalid', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });
    });

    describe('Breadcrumb Navigation', () => {
        it('should define breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should include home link in breadcrumb', () => {
            expect(content).toContain("{ label: tDetail('home'), href: `/${locale}/` }");
        });

        it('should include destinations link in breadcrumb', () => {
            expect(content).toContain(
                "{ label: tDetail('destinations'), href: `/${locale}/destinos/` }"
            );
        });

        it('should include destination name in breadcrumb', () => {
            expect(content).toContain('{ label: destinationName }');
        });

        it('should render Breadcrumb component', () => {
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });
    });

    describe('Hero Section', () => {
        it('should have hero image container', () => {
            expect(content).toContain('<!-- Hero section -->');
        });

        it('should display hero image', () => {
            expect(content).toContain('src={destinationHeroImage}');
        });

        it('should have gradient overlay', () => {
            expect(content).toContain('bg-gradient-to-t from-black/60');
        });

        it('should display province badge', () => {
            expect(content).toContain('<Badge');
            expect(content).toContain('label={destinationProvince}');
        });

        it('should display destination name as h1', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('{destinationName}');
        });
    });

    describe('Action Buttons', () => {
        it('should have action buttons section', () => {
            expect(content).toContain('<!-- Action buttons -->');
        });

        it('should include FavoriteButtonIsland with server:defer', () => {
            expect(content).toContain('<FavoriteButtonIsland');
            expect(content).toContain('server:defer');
            expect(content).toContain('entityId={destinationId}');
            expect(content).toContain('entityType="destination"');
        });

        it('should include ShareButtons with client:visible', () => {
            expect(content).toContain('<ShareButtons');
            expect(content).toContain('client:visible');
            expect(content).toContain('url={pageUrl}');
            expect(content).toContain('title={destinationName}');
        });
    });

    describe('Authentication State', () => {
        it('should use server:defer for FavoriteButtonIsland (auth resolved at request time)', () => {
            expect(content).toContain('<FavoriteButtonIsland');
            expect(content).toContain('server:defer');
        });

        it('should not derive isAuthenticated in the page (delegated to server islands)', () => {
            expect(content).not.toContain('const isAuthenticated = !!Astro.locals.user');
        });

        it('should not have any hardcoded isAuthenticated={false}', () => {
            expect(content).not.toMatch(/isAuthenticated=\{false\}/);
        });
    });

    describe('TipTap Content Rendering', () => {
        it('should extract description content from destination', () => {
            expect(content).toContain('const descriptionContent = destination.description');
        });

        it('should extract howToGetThere content from destination', () => {
            expect(content).toContain('const howToGetThereContent = destination.howToGetThere');
        });

        it('should render description with renderTiptapContent', () => {
            expect(content).toContain(
                'const renderedDescription = renderTiptapContent({ content: descriptionContent })'
            );
        });

        it('should render howToGetThere with renderTiptapContent', () => {
            expect(content).toContain(
                'const renderedHowToGetThere = renderTiptapContent({ content: howToGetThereContent })'
            );
        });

        it('should use set:html for rendered description', () => {
            expect(content).toContain('set:html={renderedDescription}');
        });

        it('should use set:html for rendered howToGetThere', () => {
            expect(content).toContain('set:html={renderedHowToGetThere}');
        });
    });

    describe('Description Section', () => {
        it('should have description section', () => {
            expect(content).toContain('<!-- Description -->');
        });

        it('should display description heading', () => {
            expect(content).toContain("{tDetail('description')}");
        });

        it('should use prose class for description content', () => {
            expect(content).toContain('class="prose max-w-none');
        });
    });

    describe('Image Gallery', () => {
        it('should have gallery section', () => {
            expect(content).toContain('<!-- Image Gallery -->');
        });

        it('should display gallery heading', () => {
            expect(content).toContain("{tDetail('gallery')}");
        });

        it('should render ImageGallery with client:visible', () => {
            expect(content).toContain('<ImageGallery client:visible images={destinationImages}');
        });
    });

    describe('Climate Section', () => {
        it('should have climate section', () => {
            expect(content).toContain('<!-- Climate -->');
        });

        it('should display climate heading', () => {
            expect(content).toContain("{tDetail('climate')}");
        });

        it('should display summer temperature', () => {
            expect(content).toContain("{tDetail('summer')}");
            expect(content).toContain('{destinationClimate.summer}');
        });

        it('should display winter temperature', () => {
            expect(content).toContain("{tDetail('winter')}");
            expect(content).toContain('{destinationClimate.winter}');
        });

        it('should display best season', () => {
            expect(content).toContain("{tDetail('bestSeason')}");
            expect(content).toContain('{destinationClimate.bestSeason}');
        });

        it('should display rainfall information', () => {
            expect(content).toContain("{tDetail('rainfall')}");
            expect(content).toContain('{destinationClimate.rainfall}');
        });

        it('should use grid layout for climate info', () => {
            expect(content).toContain('grid grid-cols-2 gap-4 md:grid-cols-4');
        });
    });

    describe('How to Get There Section', () => {
        it('should have how to get there section', () => {
            expect(content).toContain('<!-- How to get there -->');
        });

        it('should display how to get there heading', () => {
            expect(content).toContain("{tDetail('howToGetThere')}");
        });

        it('should use prose class for rendered content', () => {
            expect(content).toContain('set:html={renderedHowToGetThere}');
            expect(content).toContain('class="prose max-w-none');
        });
    });

    describe('Attractions Section', () => {
        it('should have attractions section', () => {
            expect(content).toContain('<!-- Attractions -->');
        });

        it('should display attractions heading', () => {
            expect(content).toContain("{tDetail('attractions')}");
        });

        it('should render attractions list', () => {
            expect(content).toContain('destinationAttractions.map');
        });

        it('should display attraction name', () => {
            expect(content).toContain('{attraction.name}');
        });

        it('should display attraction description', () => {
            expect(content).toContain('{attraction.description}');
        });
    });

    describe('Map Section', () => {
        it('should have map section', () => {
            expect(content).toContain('<!-- Map -->');
        });

        it('should display map heading', () => {
            expect(content).toContain("{tDetail('map')}");
        });

        it('should render MapView with client:visible', () => {
            expect(content).toContain('<MapView');
            expect(content).toContain('client:visible');
        });

        it('should define map markers with conditional logic', () => {
            expect(content).toContain('const mapMarkers = destinationLocation.lat');
        });

        it('should pass markers to MapView', () => {
            expect(content).toContain('markers={mapMarkers}');
        });

        it('should set map center', () => {
            expect(content).toContain(
                'center={[destinationLocation.lat, destinationLocation.lng]}'
            );
        });

        it('should set map zoom level', () => {
            expect(content).toContain('zoom={13}');
        });
    });

    describe('Accommodations Section', () => {
        it('should have accommodations section', () => {
            expect(content).toContain('<!-- Accommodations section -->');
        });

        it('should use Section component for accommodations', () => {
            expect(content).toContain(
                "<Section title={`${tDetail('accommodationsIn')} ${destinationName}`}"
            );
        });

        it('should render AccommodationCardFeatured in grid', () => {
            expect(content).toContain('previewAccommodations.map');
            expect(content).toContain('<AccommodationCardFeatured accommodation={accommodation}');
        });

        it('should pass locale to AccommodationCard', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should show EmptyState when no accommodations', () => {
            expect(content).toContain('<EmptyState');
            expect(content).toContain("title={tDetail('noAccommodations')}");
            expect(content).toContain("message={tDetail('noAccommodationsMessage')}");
        });

        it('should use conditional rendering for accommodations', () => {
            expect(content).toContain('previewAccommodations.length > 0');
        });
    });

    describe('Events Section', () => {
        it('should have events section', () => {
            expect(content).toContain('<!-- Events section -->');
        });

        it('should use Section component for events', () => {
            expect(content).toContain(
                "<Section title={`${tDetail('eventsIn')} ${destinationName}`}"
            );
        });

        it('should render EventCard in grid', () => {
            expect(content).toContain('previewEvents.map');
            expect(content).toContain('<EventCard event={event}');
        });

        it('should pass locale to EventCard', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should show EmptyState when no events', () => {
            expect(content).toContain('<EmptyState');
            expect(content).toContain("title={tDetail('noEvents')}");
            expect(content).toContain("message={tDetail('noEventsMessage')}");
        });

        it('should use conditional rendering for events', () => {
            expect(content).toContain('previewEvents.length > 0');
        });
    });

    describe('Sidebar', () => {
        it('should have right sidebar', () => {
            expect(content).toContain('<!-- Right sidebar (1/3) -->');
        });

        it('should use sticky positioning for sidebar', () => {
            expect(content).toContain('lg:sticky lg:top-4');
        });

        it('should display accommodations count', () => {
            expect(content).toContain('{accommodationCount}');
        });

        it('should display events count', () => {
            expect(content).toContain('{eventCount}');
        });

        it('should have view all link for accommodations', () => {
            expect(content).toContain('href={accommodationsListUrl}');
        });

        it('should have view all link for events', () => {
            expect(content).toContain('href={eventsListUrl}');
        });
    });

    describe('SEO Head', () => {
        it('should include SEOHead component', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
        });

        it('should pass title to SEOHead', () => {
            expect(content).toContain('title={destinationName}');
        });

        it('should pass locale to SEOHead', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should pass image to SEOHead', () => {
            expect(content).toContain('image={destinationHeroImage}');
        });
    });

    describe('Localization', () => {
        it('should import i18n t function', () => {
            expect(content).toContain("import { t as i18nT } from '../../../lib/i18n'");
        });

        it('should define tDetail helper using i18n', () => {
            expect(content).toContain('const tDetail = (key: string)');
            expect(content).toContain("namespace: 'destinations'");
            expect(content).toContain('`detailPage.${key}`');
        });

        it('should use tDetail for home and destinations keys', () => {
            expect(content).toContain("tDetail('home')");
            expect(content).toContain("tDetail('destinations')");
        });

        it('should use tDetail for gallery and climate keys', () => {
            expect(content).toContain("tDetail('gallery')");
            expect(content).toContain("tDetail('climate')");
        });

        it('should use tDetail for howToGetThere and attractions', () => {
            expect(content).toContain("tDetail('howToGetThere')");
            expect(content).toContain("tDetail('attractions')");
        });

        it('should have localized empty state messages via tDetail', () => {
            expect(content).toContain("tDetail('noAccommodations')");
            expect(content).toContain("tDetail('noAccommodationsMessage')");
            expect(content).toContain("tDetail('noEvents')");
            expect(content).toContain("tDetail('noEventsMessage')");
        });
    });

    describe('Layout Structure', () => {
        it('should use BaseLayout wrapper', () => {
            expect(content).toContain('<BaseLayout');
            expect(content).toContain('</BaseLayout>');
        });

        it('should use Container component', () => {
            expect(content).toContain('<Container>');
            expect(content).toContain('</Container>');
        });

        it('should use responsive grid layout', () => {
            expect(content).toContain('grid grid-cols-1 gap-8 lg:grid-cols-3');
        });

        it('should have two-column main layout', () => {
            expect(content).toContain('lg:col-span-2');
        });
    });

    describe('API Integration', () => {
        it('should define getStaticPaths function', () => {
            expect(content).toContain('export async function getStaticPaths()');
        });

        it('should call destinationsApi.list in getStaticPaths', () => {
            expect(content).toContain('fetchAllPages');
            expect(content).toContain('destinationsApi.list');
        });

        it('should check result.ok before using data', () => {
            expect(content).toContain('destResult.ok');
        });

        it('should fetch destination data from props or API', () => {
            expect(content).toContain(
                'let destination: Record<string, unknown> = destinationData || {}'
            );
        });

        it('should extract destination ID', () => {
            expect(content).toContain('const destinationId = String(destination.id');
        });

        it('should fetch accommodations for destination', () => {
            expect(content).toContain('await destinationsApi.getAccommodations');
        });

        it('should fetch events for destination', () => {
            expect(content).toContain('await eventsApi.list');
        });

        it('should enable prerender', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should handle catch-all path parameter', () => {
            expect(content).toContain('const { path } = Astro.params');
        });
    });

    describe('Rendering Strategy', () => {
        it('should use SSG with prerender', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should generate static paths for all locales', () => {
            expect(content).toContain('const locales = SUPPORTED_LOCALES');
        });
    });
});
