/**
 * Tests for Accommodation by Type page.
 * Verifies page structure, SEO elements, localization, type validation, and content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const accommodationTypePath = resolve(
    __dirname,
    '../../src/pages/[lang]/alojamientos/tipo/[type]/index.astro'
);
const content = readFileSync(accommodationTypePath, 'utf8');

describe('alojamientos/tipo/[type]/index.astro', () => {
    describe('Rendering Strategy (SSG + ISR)', () => {
        it('should enable prerendering', () => {
            expect(content).toContain('export const prerender = true;');
        });

        it('should export getStaticPaths function', () => {
            expect(content).toContain('export function getStaticPaths()');
        });

        it('should generate paths for all locale and type combinations', () => {
            expect(content).toContain('const locales = SUPPORTED_LOCALES');
            expect(content).toContain(
                "const types = ['hotel', 'hostel', 'cabin', 'apartment', 'camping', 'estancia', 'posada']"
            );
        });
    });

    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(content).toContain(
                "import BaseLayout from '../../../../../layouts/BaseLayout.astro'"
            );
            expect(content).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../../../components/seo/SEOHead.astro'"
            );
            expect(content).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../../../components/ui/Breadcrumb.astro'"
            );
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(content).toContain(
                "import Container from '../../../../../components/ui/Container.astro'"
            );
            expect(content).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(content).toContain(
                "import Section from '../../../../../components/ui/Section.astro'"
            );
            expect(content).toContain('<Section>');
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

        it('should import t from lib/i18n', () => {
            expect(content).toContain("import { t } from '../../../../../lib/i18n'");
        });

        it('should import accommodationsApi', () => {
            expect(content).toContain(
                "import { accommodationsApi } from '../../../../../lib/api/endpoints'"
            );
        });

        it('should import EmptyState', () => {
            expect(content).toContain(
                "import EmptyState from '../../../../../components/ui/EmptyState.astro'"
            );
        });
    });

    describe('Type validation', () => {
        it('should define allowed accommodation types', () => {
            expect(content).toContain('const ALLOWED_TYPES');
            expect(content).toContain("'hotel'");
            expect(content).toContain("'hostel'");
            expect(content).toContain("'cabin'");
            expect(content).toContain("'apartment'");
            expect(content).toContain("'camping'");
            expect(content).toContain("'estancia'");
            expect(content).toContain("'posada'");
        });

        it('should validate type parameter', () => {
            expect(content).toContain('if (!type || !ALLOWED_TYPES.includes(type');
        });

        it('should redirect to accommodations page on invalid type', () => {
            expect(content).toContain('return Astro.redirect(`/${locale}/alojamientos/`)');
        });

        it('should type cast validated type', () => {
            expect(content).toContain('const accommodationType = type as AccommodationType');
        });
    });

    describe('Localization - Type names', () => {
        it('should use t() for type name', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'accommodations', key: `typePage.typeDetails.${accommodationType}.name` })"
            );
        });
    });

    describe('Localization - Type descriptions', () => {
        it('should use t() for type description', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'accommodations', key: `typePage.typeDetails.${accommodationType}.description` })"
            );
        });
    });

    describe('Localization - Page titles', () => {
        it('should use t() for page title', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'accommodations', key: `typePage.typeDetails.${accommodationType}.pageTitle` })"
            );
        });
    });

    describe('Localization - Common labels', () => {
        it('should use t() for breadcrumb home', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'accommodations', key: 'typePage.labels.breadcrumbHome' })"
            );
        });

        it('should use t() for breadcrumb accommodations', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'accommodations', key: 'typePage.labels.breadcrumbAccommodations' })"
            );
        });

        it('should use t() for empty title with type interpolation', () => {
            expect(content).toContain(
                "t({ locale, namespace: 'accommodations', key: 'typePage.labels.emptyTitle', params: { type: typeName.toLowerCase() } })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(content).toContain('title={pageTitle}');
            expect(content).toContain('description={typeDescription}');
        });

        it('should set page type to website', () => {
            expect(content).toContain('type="website"');
        });

        it('should pass locale directly to SEOHead', () => {
            expect(content).toContain('locale={locale}');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(content).toContain('{ label: breadcrumbHome, href: `/${locale}/`');
        });

        it('should have accommodations breadcrumb link', () => {
            expect(content).toContain(
                '{ label: breadcrumbAccommodations, href: `/${locale}/alojamientos/`'
            );
        });

        it('should have type breadcrumb link', () => {
            expect(content).toContain(
                '{ label: typeName, href: `/${locale}/alojamientos/tipo/${accommodationType}/`'
            );
        });
    });

    describe('Content sections', () => {
        it('should have type header section', () => {
            expect(content).toContain('id="type-header"');
        });

        it('should have accommodation grid section', () => {
            expect(content).toContain('id="accommodation-grid"');
        });

        it('should have pagination section', () => {
            expect(content).toContain('id="pagination"');
        });
    });

    describe('Type header section', () => {
        it('should display type name as h1', () => {
            expect(content).toContain('text-4xl font-bold');
            expect(content).toContain('md:text-5xl');
            expect(content).toContain('{typeName}');
        });

        it('should display type description', () => {
            expect(content).toContain('text-xl leading-relaxed');
            expect(content).toContain('{typeDescription}');
        });
    });

    describe('Empty state', () => {
        it('should generate empty state message', () => {
            expect(content).toContain('const emptyMessage =');
            expect(content).toContain('emptyTitle');
        });

        it('should display empty state message', () => {
            expect(content).toContain('{emptyMessage}');
        });

        it('should render EmptyState component', () => {
            expect(content).toContain('<EmptyState title={emptyMessage}');
        });

        it('should conditionally render accommodations or empty state', () => {
            expect(content).toContain('accommodations.length > 0');
        });
    });

    describe('API Integration', () => {
        it('should fetch accommodations filtered by type', () => {
            expect(content).toContain('const apiResult = await accommodationsApi.list');
        });

        it('should check apiResult.ok before using data', () => {
            expect(content).toContain('apiResult.ok');
        });

        it('should extract accommodations from API response', () => {
            expect(content).toContain(
                'const accommodations = apiResult.ok ? apiResult.data.items : []'
            );
        });

        it('should extract pagination from API response', () => {
            expect(content).toContain(
                'const pagination = apiResult.ok ? apiResult.data.pagination'
            );
        });

        it('should pass page and pageSize to API', () => {
            expect(content).toContain('page, pageSize');
        });

        it('should pass accommodation type to API', () => {
            expect(content).toContain('type: accommodationType');
        });
    });

    describe('Accommodation Grid', () => {
        it('should render AccommodationCardFeatured components', () => {
            expect(content).toContain(
                '<AccommodationCardFeatured accommodation={toAccommodationCardProps('
            );
        });

        it('should pass locale to AccommodationCard', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should use responsive grid layout', () => {
            expect(content).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });
    });

    describe('Page styling', () => {
        it('should have main heading with proper styling', () => {
            expect(content).toContain('text-4xl font-bold');
            expect(content).toContain('md:text-5xl');
            expect(content).toContain('text-text-primary');
        });

        it('should have description with proper styling', () => {
            expect(content).toContain('text-xl leading-relaxed');
            expect(content).toContain('text-text-secondary');
        });

        it('should use Container component for consistent spacing', () => {
            expect(content).toContain('<Container>');
        });

        it('should use Section component for vertical spacing', () => {
            expect(content).toContain('<Section>');
        });
    });

    describe('Accessibility', () => {
        it('should have semantic article elements', () => {
            expect(content).toMatch(/<article\s+id=/);
        });

        it('should have accessible heading structure', () => {
            expect(content).toContain('<h1');
        });

        it('should use heading hierarchy', () => {
            expect(content).toContain('<h1');
        });
    });

    describe('Type handling', () => {
        it('should handle all accommodation types', () => {
            const types = [
                'hotel',
                'hostel',
                'cabin',
                'apartment',
                'camping',
                'estancia',
                'posada'
            ];
            for (const type of types) {
                expect(content).toContain(`'${type}'`);
            }
        });

        it('should create TypeScript type from allowed types', () => {
            expect(content).toContain('type AccommodationType');
            expect(content).toContain('typeof ALLOWED_TYPES)[number]');
        });
    });
});
