import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Test Suite: SPEC-011 hreflang Verification
 *
 * Verifies that all new pages created in SPEC-011 properly implement SEOHead
 * component with correct locale handling for hreflang alternate link generation.
 *
 * Each page must:
 * 1. Import SEOHead component
 * 2. Use SEOHead with slot="head"
 * 3. Pass locale prop to SEOHead (for correct hreflang generation)
 * 4. Define canonicalUrl variable used in SEOHead
 *
 * Note: SEOHead automatically generates hreflang tags for es/en/pt + x-default.
 */

const PAGE_PATHS = {
    eventCategory: resolve(
        __dirname,
        '../../src/pages/[lang]/eventos/categoria/[category]/index.astro'
    ),
    postTag: resolve(__dirname, '../../src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro'),
    owners: resolve(__dirname, '../../src/pages/[lang]/propietarios/index.astro'),
    destinationAccommodations: resolve(
        __dirname,
        '../../src/pages/[lang]/destinos/[slug]/alojamientos/index.astro'
    )
};

describe('SPEC-011: hreflang Verification', () => {
    /**
     * Test: Event Category Page (eventos/categoria/[category]/index.astro)
     */
    describe('Event Category Page', () => {
        let content: string;

        beforeAll(() => {
            content = readFileSync(PAGE_PATHS.eventCategory, 'utf8');
        });

        it('should import SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../../../components/seo/SEOHead.astro'"
            );
        });

        it('should use SEOHead with slot="head"', () => {
            expect(content).toMatch(/<SEOHead\s+slot="head"/);
        });

        it('should pass locale prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?locale=\{locale === 'pt' \? 'es' : locale\}/);
        });

        it('should pass title prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?title=\{pageTitle\}/);
        });

        it('should pass description prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?description=\{categoryDescription\}/);
        });

        it('should pass canonical prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?canonical=\{canonicalUrl\}/);
        });

        it('should define canonicalUrl variable', () => {
            expect(content).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href'
            );
        });

        it('should pass type prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?type="website"/);
        });

        it('should use prerender for static generation', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should have getStaticPaths for generating locale + category combinations', () => {
            expect(content).toContain('export function getStaticPaths()');
        });
    });

    /**
     * Test: Post Tag Page (publicaciones/etiqueta/[tag]/index.astro)
     */
    describe('Post Tag Page', () => {
        let content: string;

        beforeAll(() => {
            content = readFileSync(PAGE_PATHS.postTag, 'utf8');
        });

        it('should import SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../../../components/seo/SEOHead.astro'"
            );
        });

        it('should use SEOHead with slot="head"', () => {
            expect(content).toMatch(/<SEOHead\s+slot="head"/);
        });

        it('should pass locale prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?locale=\{locale === 'pt' \? 'es' : locale\}/);
        });

        it('should pass title prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?title=\{pageTitle\}/);
        });

        it('should pass description prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?description=\{metaDescription\}/);
        });

        it('should pass canonical prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?canonical=\{canonicalUrl\}/);
        });

        it('should define canonicalUrl variable', () => {
            expect(content).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href'
            );
        });

        it('should pass type prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?type="website"/);
        });

        it('should not have prerender (SSR for dynamic tags)', () => {
            expect(content).not.toContain('export const prerender = true');
        });

        it('should validate locale parameter', () => {
            expect(content).toContain('isValidLocale(lang)');
        });

        it('should validate tag parameter', () => {
            expect(content).toContain("!tag || typeof tag !== 'string' || tag.trim() === ''");
        });
    });

    /**
     * Test: Property Owners Page (propietarios/index.astro)
     */
    describe('Property Owners Page', () => {
        let content: string;

        beforeAll(() => {
            content = readFileSync(PAGE_PATHS.owners, 'utf8');
        });

        it('should import SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should use SEOHead with slot="head"', () => {
            expect(content).toMatch(/<SEOHead\s+slot="head"/);
        });

        it('should pass locale prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?locale=\{locale === 'pt' \? 'es' : locale\}/);
        });

        it('should pass title prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?title=\{titles\[locale\]\}/);
        });

        it('should pass description prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?description=\{descriptions\[locale\]\}/);
        });

        it('should pass canonical prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?canonical=\{canonicalUrl\}/);
        });

        it('should define canonicalUrl variable', () => {
            expect(content).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href'
            );
        });

        it('should pass type prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?type="website"/);
        });

        it('should use prerender for static generation', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should have getStaticPaths for generating locale combinations', () => {
            expect(content).toContain('export function getStaticPaths()');
        });

        it('should define localized titles', () => {
            expect(content).toContain('const titles: Record<SupportedLocale, string>');
        });

        it('should define localized descriptions', () => {
            expect(content).toContain('const descriptions: Record<SupportedLocale, string>');
        });
    });

    /**
     * Test: Destination Accommodations Page (destinos/[slug]/alojamientos/index.astro)
     */
    describe('Destination Accommodations Page', () => {
        let content: string;

        beforeAll(() => {
            content = readFileSync(PAGE_PATHS.destinationAccommodations, 'utf8');
        });

        it('should import SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../../../components/seo/SEOHead.astro'"
            );
        });

        it('should use SEOHead with slot="head"', () => {
            expect(content).toMatch(/<SEOHead\s+slot="head"/);
        });

        it('should pass locale prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?locale=\{locale === 'pt' \? 'es' : locale\}/);
        });

        it('should pass title prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?title=\{pageTitle\}/);
        });

        it('should pass description prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?description=\{pageDescription\}/);
        });

        it('should pass canonical prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?canonical=\{canonicalUrl\}/);
        });

        it('should define canonicalUrl variable', () => {
            expect(content).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href'
            );
        });

        it('should pass type prop to SEOHead', () => {
            expect(content).toMatch(/<SEOHead[\s\S]*?type="website"/);
        });

        it('should not have prerender (SSR for dynamic slugs)', () => {
            expect(content).not.toContain('export const prerender = true');
        });

        it('should validate locale parameter', () => {
            expect(content).toContain('isValidLocale(lang)');
        });

        it('should validate slug parameter', () => {
            expect(content).toContain('if (!slug)');
        });

        it('should define pageTitle variable', () => {
            expect(content).toContain('const pageTitle');
        });

        it('should define pageDescription variable', () => {
            expect(content).toContain('const pageDescription');
        });
    });

    /**
     * Test: Hreflang Tag Structure
     * All pages should generate identical hreflang tag structure through SEOHead
     */
    describe('Hreflang Tag Structure (via SEOHead)', () => {
        it('should generate hreflang es tag', () => {
            const seoContent = readFileSync(
                resolve(__dirname, '../../src/components/seo/SEOHead.astro'),
                'utf8'
            );
            expect(seoContent).toContain('hreflang="es"');
        });

        it('should generate hreflang en tag', () => {
            const seoContent = readFileSync(
                resolve(__dirname, '../../src/components/seo/SEOHead.astro'),
                'utf8'
            );
            expect(seoContent).toContain('hreflang="en"');
        });

        it('should generate hreflang pt tag', () => {
            const seoContent = readFileSync(
                resolve(__dirname, '../../src/components/seo/SEOHead.astro'),
                'utf8'
            );
            expect(seoContent).toContain('hreflang="pt"');
        });

        it('should generate x-default hreflang tag', () => {
            const seoContent = readFileSync(
                resolve(__dirname, '../../src/components/seo/SEOHead.astro'),
                'utf8'
            );
            expect(seoContent).toContain('hreflang="x-default"');
        });

        it('should use canonical URL for es and x-default hreflang', () => {
            const seoContent = readFileSync(
                resolve(__dirname, '../../src/components/seo/SEOHead.astro'),
                'utf8'
            );
            expect(seoContent).toContain("const esUrl = generateAlternateUrl('es')");
            expect(seoContent).toContain('href={esUrl}');
        });

        it('should use generateAlternateUrl function for locale switching', () => {
            const seoContent = readFileSync(
                resolve(__dirname, '../../src/components/seo/SEOHead.astro'),
                'utf8'
            );
            expect(seoContent).toContain('const generateAlternateUrl');
            expect(seoContent).toContain('targetLocale');
        });
    });

    /**
     * Test: Common SEO Pattern Across SPEC-011 Pages
     */
    describe('Common SEO Patterns in SPEC-011 Pages', () => {
        it('Event Category page should validate category parameter', () => {
            const content = readFileSync(PAGE_PATHS.eventCategory, 'utf8');
            expect(content).toMatch(/ALLOWED_CATEGORIES|const ALLOWED_CATEGORIES/);
        });

        it('All pages should validate locale before using it', () => {
            const eventCategoryContent = readFileSync(PAGE_PATHS.eventCategory, 'utf8');
            const postTagContent = readFileSync(PAGE_PATHS.postTag, 'utf8');
            const ownersContent = readFileSync(PAGE_PATHS.owners, 'utf8');
            const destinationAccommodationsContent = readFileSync(
                PAGE_PATHS.destinationAccommodations,
                'utf8'
            );

            expect(eventCategoryContent).toContain('isValidLocale');
            expect(postTagContent).toContain('isValidLocale');
            expect(ownersContent).toContain('isValidLocale');
            expect(destinationAccommodationsContent).toContain('isValidLocale');
        });

        it('All pages should use SupportedLocale type', () => {
            const eventCategoryContent = readFileSync(PAGE_PATHS.eventCategory, 'utf8');
            const postTagContent = readFileSync(PAGE_PATHS.postTag, 'utf8');
            const ownersContent = readFileSync(PAGE_PATHS.owners, 'utf8');
            const destinationAccommodationsContent = readFileSync(
                PAGE_PATHS.destinationAccommodations,
                'utf8'
            );

            expect(eventCategoryContent).toContain('SupportedLocale');
            expect(postTagContent).toContain('SupportedLocale');
            expect(ownersContent).toContain('SupportedLocale');
            expect(destinationAccommodationsContent).toContain('SupportedLocale');
        });

        it('All pages should define breadcrumb items', () => {
            const eventCategoryContent = readFileSync(PAGE_PATHS.eventCategory, 'utf8');
            const postTagContent = readFileSync(PAGE_PATHS.postTag, 'utf8');
            const ownersContent = readFileSync(PAGE_PATHS.owners, 'utf8');
            const destinationAccommodationsContent = readFileSync(
                PAGE_PATHS.destinationAccommodations,
                'utf8'
            );

            expect(eventCategoryContent).toContain('breadcrumbItems');
            expect(postTagContent).toContain('breadcrumbItems');
            expect(ownersContent).toContain('breadcrumbItems');
            expect(destinationAccommodationsContent).toContain('breadcrumbItems');
        });

        it('All pages should use BaseLayout wrapper', () => {
            const eventCategoryContent = readFileSync(PAGE_PATHS.eventCategory, 'utf8');
            const postTagContent = readFileSync(PAGE_PATHS.postTag, 'utf8');
            const ownersContent = readFileSync(PAGE_PATHS.owners, 'utf8');
            const destinationAccommodationsContent = readFileSync(
                PAGE_PATHS.destinationAccommodations,
                'utf8'
            );

            expect(eventCategoryContent).toContain('<BaseLayout');
            expect(postTagContent).toContain('<BaseLayout');
            expect(ownersContent).toContain('<BaseLayout');
            expect(destinationAccommodationsContent).toContain('<BaseLayout');
        });

        it('All pages should pass locale to BaseLayout', () => {
            const eventCategoryContent = readFileSync(PAGE_PATHS.eventCategory, 'utf8');
            const postTagContent = readFileSync(PAGE_PATHS.postTag, 'utf8');
            const ownersContent = readFileSync(PAGE_PATHS.owners, 'utf8');
            const destinationAccommodationsContent = readFileSync(
                PAGE_PATHS.destinationAccommodations,
                'utf8'
            );

            expect(eventCategoryContent).toMatch(/<BaseLayout[\s\S]*?locale=\{locale\}/);
            expect(postTagContent).toMatch(/<BaseLayout[\s\S]*?locale=\{locale\}/);
            expect(ownersContent).toMatch(/<BaseLayout[\s\S]*?locale=\{locale\}/);
            expect(destinationAccommodationsContent).toMatch(
                /<BaseLayout[\s\S]*?locale=\{locale\}/
            );
        });
    });

    /**
     * Test: SEOHead Component Requirements Met by Pages
     */
    describe('SEOHead Component Requirements Validation', () => {
        it('Event Category page provides all required SEOHead props', () => {
            const content = readFileSync(PAGE_PATHS.eventCategory, 'utf8');
            // Extract SEOHead component usage
            const seoHeadMatch = content.match(/<SEOHead\s+([\s\S]*?)\/>/);
            expect(seoHeadMatch).toBeTruthy();

            const seoHeadContent = seoHeadMatch![1];
            expect(seoHeadContent).toContain('title=');
            expect(seoHeadContent).toContain('description=');
            expect(seoHeadContent).toContain('canonical=');
            expect(seoHeadContent).toContain('locale=');
            expect(seoHeadContent).toContain('type=');
        });

        it('Post Tag page provides all required SEOHead props', () => {
            const content = readFileSync(PAGE_PATHS.postTag, 'utf8');
            const seoHeadMatch = content.match(/<SEOHead\s+([\s\S]*?)\/>/);
            expect(seoHeadMatch).toBeTruthy();

            const seoHeadContent = seoHeadMatch![1];
            expect(seoHeadContent).toContain('title=');
            expect(seoHeadContent).toContain('description=');
            expect(seoHeadContent).toContain('canonical=');
            expect(seoHeadContent).toContain('locale=');
            expect(seoHeadContent).toContain('type=');
        });

        it('Owners page provides all required SEOHead props', () => {
            const content = readFileSync(PAGE_PATHS.owners, 'utf8');
            const seoHeadMatch = content.match(/<SEOHead\s+([\s\S]*?)\/>/);
            expect(seoHeadMatch).toBeTruthy();

            const seoHeadContent = seoHeadMatch![1];
            expect(seoHeadContent).toContain('title=');
            expect(seoHeadContent).toContain('description=');
            expect(seoHeadContent).toContain('canonical=');
            expect(seoHeadContent).toContain('locale=');
            expect(seoHeadContent).toContain('type=');
        });

        it('Destination Accommodations page provides all required SEOHead props', () => {
            const content = readFileSync(PAGE_PATHS.destinationAccommodations, 'utf8');
            const seoHeadMatch = content.match(/<SEOHead\s+([\s\S]*?)\/>/);
            expect(seoHeadMatch).toBeTruthy();

            const seoHeadContent = seoHeadMatch![1];
            expect(seoHeadContent).toContain('title=');
            expect(seoHeadContent).toContain('description=');
            expect(seoHeadContent).toContain('canonical=');
            expect(seoHeadContent).toContain('locale=');
            expect(seoHeadContent).toContain('type=');
        });
    });
});

/**
 * Hook: Setup before all tests
 */
beforeAll(() => {
    // All file reading happens in individual test blocks
    // This hook is a placeholder for any global setup if needed
});
