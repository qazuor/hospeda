/**
 * Tests for Destination List page (Destinos).
 * Verifies page structure, SEO elements, localization, and content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const destinosIndexPath = resolve(__dirname, '../../src/pages/[lang]/destinos/index.astro');
const content = readFileSync(destinosIndexPath, 'utf8');

describe('destinos/index.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
            expect(content).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(content).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(content).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(content).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(content).toContain("import Section from '../../../components/ui/Section.astro'");
            expect(content).toContain('<Section>');
        });

        it('should import DestinationCard', () => {
            expect(content).toContain(
                "import DestinationCard from '../../../components/destination/DestinationCard.astro'"
            );
        });

        it('should import EmptyState', () => {
            expect(content).toContain(
                "import EmptyState from '../../../components/ui/EmptyState.astro'"
            );
        });

        it('should import DestinationErrorState', () => {
            expect(content).toContain(
                "import DestinationErrorState from '../../../components/error/DestinationErrorState.astro'"
            );
        });

        it('should import destinationsApi', () => {
            expect(content).toContain(
                "import { destinationsApi } from '../../../lib/api/endpoints'"
            );
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
            expect(content).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(content).toContain('getLocaleFromParams');
        });
    });

    describe('Localization', () => {
        it('should use t() for page title', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.title' })"
            );
        });

        it('should use t() for page description', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.description' })"
            );
        });

        it('should have localized home breadcrumb labels', () => {
            expect(content).toContain('HOME_BREADCRUMB');
            expect(content).toContain("from '../../../lib/page-helpers'");
        });

        it('should use t() for hero heading', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.hero.heading' })"
            );
        });

        it('should use t() for hero description', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.hero.description' })"
            );
        });

        it('should use t() for featured title', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.featured.title' })"
            );
        });

        it('should use t() for empty state texts', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.emptyState.title' })"
            );
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.emptyState.message' })"
            );
        });

        it('should use t() for regional title', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.regional.title' })"
            );
        });

        it('should use t() for regional text', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.regional.text' })"
            );
        });

        it('should import t from lib/i18n', () => {
            expect(content).toContain("import { t } from '../../../lib/i18n'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(content).toContain('title={pageTitle}');
            expect(content).toContain('description={pageDescription}');
        });

        it('should set page type to website', () => {
            expect(content).toContain('type="website"');
        });

        it('should not have noindex directive', () => {
            expect(content).not.toContain('noindex');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(content).toContain('{ label: HOME_BREADCRUMB[locale], href: `/${locale}/`');
        });

        it('should have destinations page breadcrumb', () => {
            expect(content).toContain('{ label: pageTitle, href: `/${locale}/destinos/`');
        });
    });

    describe('Content sections', () => {
        it('should have hero section', () => {
            expect(content).toContain('id="hero"');
            expect(content).toContain('{heroHeading}');
            expect(content).toContain('{heroDescription}');
        });

        it('should have search bar section with DestinationFilters island', () => {
            expect(content).toContain('id="search-bar"');
            expect(content).toContain('<DestinationFilters');
            expect(content).toContain('client:load');
        });

        it('should have featured destinations section', () => {
            expect(content).toContain('id="featured-destinations"');
            expect(content).toContain('{featuredTitle}');
        });

        it('should have destination grid area', () => {
            expect(content).toContain('id="destination-grid"');
        });

        it('should show EmptyState when no destinations', () => {
            expect(content).toContain('destinations.length > 0');
            expect(content).toContain('<EmptyState');
        });

        it('should track API error state', () => {
            expect(content).toContain('const apiError = !result.ok');
        });

        it('should show DestinationErrorState when API fails', () => {
            expect(content).toContain('<DestinationErrorState');
            expect(content).toContain('apiError');
        });

        it('should render DestinationCard for each destination', () => {
            expect(content).toContain('<DestinationCard');
        });

        it('should have regional highlight section', () => {
            expect(content).toContain('id="regional-highlight"');
            expect(content).toContain('{regionalTitle}');
            expect(content).toContain('{regionalText}');
        });

        it('should have provinces section', () => {
            expect(content).toContain('id="provinces"');
        });
    });

    describe('Search and filters (DestinationFilters island)', () => {
        it('should import DestinationFilters client component', () => {
            expect(content).toContain(
                "import { DestinationFilters } from '../../../components/destination/DestinationFilters.client.tsx'"
            );
        });

        it('should pass initialQuery prop from URL params', () => {
            expect(content).toContain('initialQuery={initialQuery}');
            expect(content).toContain("Astro.url.searchParams.get('q')");
        });

        it('should pass initialType prop from URL params', () => {
            expect(content).toContain('initialType={initialType}');
            expect(content).toContain("Astro.url.searchParams.get('type')");
        });

        it('should pass initialParentId prop from URL params', () => {
            expect(content).toContain('initialParentId={initialParentId}');
            expect(content).toContain("Astro.url.searchParams.get('parentId')");
        });

        it('should pass locale prop', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should not have any disabled form elements', () => {
            // The disabled multi-field form has been replaced with a functional React island
            expect(content).not.toMatch(/<input[^>]*disabled/);
            expect(content).not.toMatch(/<button[^>]*disabled/);
        });

        it('should not have check-in, check-out, or guests fields', () => {
            expect(content).not.toContain('type="date"');
            expect(content).not.toContain('type="number"');
            expect(content).not.toContain('CalendarIcon');
            expect(content).not.toContain('UsersIcon');
        });
    });

    describe('Regional content', () => {
        it('should mention Entre Ríos province', () => {
            expect(content).toContain('Entre Ríos');
            expect(content).toContain('Termas naturales');
        });

        it('should mention Corrientes province', () => {
            expect(content).toContain('Corrientes');
            expect(content).toContain('Esteros del Iberá');
        });

        it('should mention Santa Fe province', () => {
            expect(content).toContain('Santa Fe');
            expect(content).toContain('Cuna de la Constitución');
        });

        it('should mention Concepción del Uruguay (via i18n key)', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'destination', key: 'listing.regional.text' })"
            );
        });
    });

    describe('Page styling', () => {
        it('should have main heading with SectionTitle component', () => {
            expect(content).toContain('<SectionTitle');
            expect(content).toContain('{heroHeading}');
        });

        it('should have section headings with SectionTitle', () => {
            expect(content).toContain('SectionTitle');
        });

        it('should have grid layout for destinations', () => {
            expect(content).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should have grid layout for provinces', () => {
            expect(content).toContain('grid gap-8 md:grid-cols-3');
        });

        it('should use card-like section with background', () => {
            expect(content).toContain('rounded-lg bg-bg p-8 shadow-sm');
        });
    });

    describe('Icons and SVG', () => {
        it('should import icon components from @repo/icons', () => {
            expect(content).toContain("from '@repo/icons'");
        });

        it('should import LocationIcon for destinations', () => {
            expect(content).toContain('LocationIcon');
        });

        it('should have icon containers with proper styling', () => {
            expect(content).toContain('rounded-full bg-primary/10');
        });
    });

    describe('API Integration', () => {
        it('should fetch destinations from API', () => {
            expect(content).toContain('const result = await destinationsApi.list');
        });

        it('should check result.ok before using data', () => {
            expect(content).toContain('result.ok');
        });

        it('should extract destinations from API response', () => {
            expect(content).toContain('const destinations = result.ok ? (result.data.items');
        });

        it('should enable prerender', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should define getStaticPaths for locales', () => {
            expect(content).toContain('getStaticLocalePaths as getStaticPaths');
        });
    });

    describe('Accessibility', () => {
        it('should have proper heading hierarchy', () => {
            expect(content).toContain('as="h1"');
            expect(content).toContain('as="h2"');
            expect(content).toContain('<h3');
        });

        it('should have aria-labels for interactive elements', () => {
            expect(content).toContain('aria-label');
        });

        it('should have role attributes for regions', () => {
            expect(content).toContain('role="region"');
        });

        it('should hide decorative SVG from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });
});
