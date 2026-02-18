/**
 * Tests for Accommodation Detail Page
 *
 * Validates structure, imports, components, and localization
 * by reading the source file and checking for required patterns.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro');
const content = readFileSync(pagePath, 'utf8');

describe('Accommodation Detail Page ([slug].astro)', () => {
    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
        });

        it('should import Container', () => {
            expect(content).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
        });

        it('should import Breadcrumb', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
        });

        it('should import SEOHead', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import LodgingBusinessJsonLd', () => {
            expect(content).toContain(
                "import LodgingBusinessJsonLd from '../../../components/seo/LodgingBusinessJsonLd.astro'"
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

        it('should import AccordionFAQ client component', () => {
            expect(content).toContain(
                "import { AccordionFAQ } from '../../../components/ui/AccordionFAQ.client.tsx'"
            );
        });

        it('should import MapView client component', () => {
            expect(content).toContain(
                "import { MapView } from '../../../components/map/MapView.client.tsx'"
            );
        });

        it('should import ReviewListIsland server island', () => {
            expect(content).toContain(
                "import ReviewListIsland from '../../../components/review/ReviewListIsland.astro'"
            );
        });

        it('should import AmenitiesList', () => {
            expect(content).toContain(
                "import AmenitiesList from '../../../components/accommodation/AmenitiesList.astro'"
            );
        });

        it('should import PriceDisplay', () => {
            expect(content).toContain(
                "import PriceDisplay from '../../../components/ui/PriceDisplay.astro'"
            );
        });

        it('should import AccommodationCard', () => {
            expect(content).toContain(
                "import AccommodationCard from '../../../components/accommodation/AccommodationCard.astro'"
            );
        });

        it('should import i18n utilities', () => {
            expect(content).toContain('import { isValidLocale, type SupportedLocale }');
            expect(content).toContain("from '../../../lib/i18n'");
        });

        it('should import renderTiptapContent', () => {
            expect(content).toContain('import { renderTiptapContent }');
            expect(content).toContain("from '../../../lib/tiptap-renderer'");
        });

        it('should import accommodationsApi', () => {
            expect(content).toContain(
                "import { accommodationsApi } from '../../../lib/api/endpoints'"
            );
        });
    });

    describe('Locale Validation', () => {
        it('should extract lang param', () => {
            expect(content).toContain('const { lang, slug } = Astro.params');
        });

        it('should validate locale', () => {
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to default locale if invalid', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should cast locale to SupportedLocale type', () => {
            expect(content).toContain('const locale = lang as SupportedLocale');
        });
    });

    describe('Content Rendering', () => {
        it('should use renderTiptapContent for description', () => {
            expect(content).toContain('renderTiptapContent');
            expect(content).toContain('renderedDescription');
        });

        it('should use set:html for rendered content', () => {
            expect(content).toContain('set:html={renderedDescription}');
        });
    });

    describe('Breadcrumb Navigation', () => {
        it('should have breadcrumb items', () => {
            expect(content).toContain('breadcrumbItems');
        });

        it('should include home in breadcrumb', () => {
            expect(content).toContain('t.home');
        });

        it('should include accommodations link in breadcrumb', () => {
            expect(content).toContain('t.accommodations');
            expect(content).toContain('alojamientos');
        });

        it('should render Breadcrumb component', () => {
            expect(content).toContain('<Breadcrumb');
            expect(content).toContain('items={breadcrumbItems}');
        });
    });

    describe('Image Gallery', () => {
        it('should render ImageGallery with client:visible', () => {
            expect(content).toContain('<ImageGallery');
            expect(content).toContain('client:visible');
        });

        it('should pass images to gallery', () => {
            expect(content).toContain('images={accommodation.images || []}');
        });
    });

    describe('Header Section', () => {
        it('should display type Badge', () => {
            expect(content).toContain('<Badge');
            expect(content).toContain("label={accommodation.type || 'HOTEL'}");
        });

        it('should display accommodation name as h1', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('{accommodation.name}');
        });

        it('should display rating', () => {
            expect(content).toContain('{accommodation.rating || 0}');
        });

        it('should display review count', () => {
            expect(content).toContain('{accommodation.reviewCount || 0}');
            expect(content).toContain('t.reviewsLabel');
        });
    });

    describe('Interactive Components', () => {
        it('should render FavoriteButtonIsland with server:defer', () => {
            expect(content).toContain('<FavoriteButtonIsland');
            expect(content).toContain('server:defer');
        });

        it('should pass entityId to FavoriteButtonIsland', () => {
            expect(content).toContain('entityId={accommodation.id}');
        });

        it('should pass entityType to FavoriteButtonIsland', () => {
            expect(content).toContain('entityType="accommodation"');
        });

        it('should render ShareButtons with client:visible', () => {
            expect(content).toContain('<ShareButtons');
            expect(content).toContain('client:visible');
        });

        it('should pass url to ShareButtons', () => {
            expect(content).toContain('url={pageUrl}');
        });

        it('should pass title to ShareButtons', () => {
            expect(content).toContain('title={accommodation.name}');
        });
    });

    describe('Authentication State', () => {
        it('should use server:defer for FavoriteButtonIsland (auth resolved at request time)', () => {
            expect(content).toContain('<FavoriteButtonIsland');
            expect(content).toContain('server:defer');
        });

        it('should use server:defer for ReviewListIsland (auth resolved at request time)', () => {
            expect(content).toContain('<ReviewListIsland');
            expect(content).toContain('server:defer');
        });

        it('should not derive isAuthenticated in the page (delegated to server islands)', () => {
            expect(content).not.toContain('const isAuthenticated = !!Astro.locals.user');
        });

        it('should not have any hardcoded isAuthenticated={false}', () => {
            expect(content).not.toMatch(/isAuthenticated=\{false\}/);
        });
    });

    describe('Content Sections', () => {
        it('should have description section', () => {
            expect(content).toContain('t.description');
        });

        it('should have amenities section', () => {
            expect(content).toContain('t.amenities');
        });

        it('should render AmenitiesList', () => {
            expect(content).toContain('<AmenitiesList');
            expect(content).toContain('amenities={accommodation.amenities || []}');
        });

        it('should have location section', () => {
            expect(content).toContain('t.location');
        });

        it('should render MapView with client:visible', () => {
            expect(content).toContain('<MapView');
            expect(content).toContain('client:visible');
        });

        it('should pass markers to MapView', () => {
            expect(content).toContain('markers={mapMarkers}');
        });

        it('should have reviews section', () => {
            expect(content).toContain('t.reviews');
        });

        it('should render ReviewListIsland with server:defer', () => {
            expect(content).toContain('<ReviewListIsland');
            expect(content).toContain('server:defer');
        });

        it('should pass reviews to ReviewListIsland', () => {
            expect(content).toContain('reviews={mockReviews}');
        });

        it('should pass totalCount to ReviewListIsland', () => {
            expect(content).toContain('totalCount={accommodation.reviewCount || 0}');
        });

        it('should pass locale to ReviewListIsland', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should have FAQ section', () => {
            expect(content).toContain('t.faq');
        });

        it('should render AccordionFAQ with client:visible', () => {
            expect(content).toContain('<AccordionFAQ');
            expect(content).toContain('client:visible');
        });

        it('should pass FAQ items', () => {
            expect(content).toContain('items={accommodation.faqs || []}');
        });
    });

    describe('Sidebar', () => {
        it('should have sticky sidebar', () => {
            expect(content).toContain('lg:sticky');
            expect(content).toContain('lg:top-4');
        });

        it('should render PriceDisplay component', () => {
            expect(content).toContain('<PriceDisplay');
        });

        it('should pass amountARS to PriceDisplay', () => {
            expect(content).toContain('amountARS={accommodation.pricePerNight || 0}');
        });

        it('should pass locale to PriceDisplay', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should display per night text', () => {
            expect(content).toContain('t.perNight');
        });

        it('should display check-in time', () => {
            expect(content).toContain('t.checkIn');
            expect(content).toContain("{accommodation.checkIn || '14:00'}");
        });

        it('should display check-out time', () => {
            expect(content).toContain('t.checkOut');
            expect(content).toContain("{accommodation.checkOut || '10:00'}");
        });

        it('should have CTA button', () => {
            expect(content).toContain('t.bookNow');
        });
    });

    describe('Similar Accommodations', () => {
        it('should have similar section', () => {
            expect(content).toContain('t.similar');
        });

        it('should render similar accommodations grid', () => {
            expect(content).toContain('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should render AccommodationCard for similar items', () => {
            expect(content).toContain('<AccommodationCard');
            expect(content).toContain('similarAccommodations.map');
        });
    });

    describe('SEO', () => {
        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
        });

        it('should render LodgingBusinessJsonLd in head slot', () => {
            expect(content).toContain('<LodgingBusinessJsonLd');
            expect(content).toContain('slot="head"');
        });

        it('should pass name to LodgingBusinessJsonLd', () => {
            expect(content).toContain('name={accommodation.name}');
        });

        it('should pass rating to LodgingBusinessJsonLd', () => {
            expect(content).toContain('rating={accommodation.rating || 0}');
        });

        it('should pass reviewCount to LodgingBusinessJsonLd', () => {
            expect(content).toContain('reviewCount={accommodation.reviewCount || 0}');
        });
    });

    describe('Localization', () => {
        it('should have localized texts for es', () => {
            expect(content).toContain('es: {');
            expect(content).toContain("home: 'Inicio'");
            expect(content).toContain("accommodations: 'Alojamientos'");
            expect(content).toContain("description: 'Descripción'");
        });

        it('should have localized texts for en', () => {
            expect(content).toContain('en: {');
            expect(content).toContain("home: 'Home'");
            expect(content).toContain("accommodations: 'Accommodations'");
            expect(content).toContain("description: 'Description'");
        });

        it('should have localized texts for pt', () => {
            expect(content).toContain('pt: {');
            expect(content).toContain("home: 'Início'");
            expect(content).toContain("accommodations: 'Acomodações'");
            expect(content).toContain("description: 'Descrição'");
        });

        it('should select texts based on locale', () => {
            expect(content).toContain('const t = texts[locale]');
        });
    });

    describe('Layout Structure', () => {
        it('should use BaseLayout', () => {
            expect(content).toContain('<BaseLayout');
        });

        it('should pass title to BaseLayout', () => {
            expect(content).toContain('title={accommodation.name}');
        });

        it('should pass description to BaseLayout', () => {
            expect(content).toContain('description={');
        });

        it('should pass locale to BaseLayout', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should pass image to BaseLayout', () => {
            expect(content).toContain(
                "image={accommodation.images?.[0]?.src || '/images/placeholder-accommodation.svg'}"
            );
        });

        it('should use Container component', () => {
            expect(content).toContain('<Container>');
        });

        it('should use Section component for similar accommodations', () => {
            expect(content).toContain('<Section');
            expect(content).toContain('title={t.similar}');
        });
    });

    describe('Grid Layout', () => {
        it('should have main content grid', () => {
            expect(content).toContain('grid grid-cols-1 gap-8 lg:grid-cols-3');
        });

        it('should have left column spanning 2/3', () => {
            expect(content).toContain('lg:col-span-2');
        });

        it('should have sections with spacing', () => {
            expect(content).toContain('space-y-8');
        });
    });

    describe('Code Quality', () => {
        it('should have descriptive JSDoc comments', () => {
            expect(content).toContain('/**');
            expect(content).toContain('Accommodation Detail Page');
        });

        it('should use const for variable declarations', () => {
            expect(content).toContain('const { lang, slug }');
            expect(content).toContain('const locale =');
            expect(content).toContain('const t =');
        });

        it('should use TypeScript types', () => {
            expect(content).toContain('SupportedLocale');
        });

        it('should be under 500 lines', () => {
            const lines = content.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });

    describe('API Integration', () => {
        it('should define getStaticPaths function', () => {
            expect(content).toContain('export async function getStaticPaths()');
        });

        it('should call accommodationsApi.list in getStaticPaths', () => {
            expect(content).toContain('await accommodationsApi.list({ pageSize: 500 })');
        });

        it('should check result.ok before using data', () => {
            expect(content).toContain('result.ok');
        });

        it('should fetch accommodation data from props or API', () => {
            expect(content).toContain('let accommodation = Astro.props.accommodation');
        });

        it('should fetch similar accommodations from API', () => {
            expect(content).toContain('const simResult = await accommodationsApi.list');
        });

        it('should redirect to list page if accommodation not found', () => {
            expect(content).toContain('return Astro.redirect(`/${locale}/alojamientos/`)');
        });

        it('should enable prerender', () => {
            expect(content).toContain('export const prerender = true');
        });
    });

    describe('Rendering Strategy', () => {
        it('should use SSG with prerender', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should generate static paths for all locales', () => {
            expect(content).toContain("const locales = ['es', 'en', 'pt']");
        });
    });
});
