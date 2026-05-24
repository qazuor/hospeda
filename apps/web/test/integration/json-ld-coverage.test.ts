/**
 * @file json-ld-coverage.test.ts
 * @description Integration test asserting that every detail page that
 * renders <Breadcrumbs /> also emits BreadcrumbList JSON-LD, and that
 * each detail page emits its primary entity JSON-LD plus any
 * page-specific structured data (FAQPage, AboutPage, Offer).
 *
 * SPEC-096 / REQ-096-37 (T-068).
 * SPEC-157 REQ-7: updated to reflect typed-component pattern (no more
 * inline JSON-LD objects in detail pages — the typed components own the schema).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');
const TRANSFORMS_FILE = resolve(__dirname, '../../src/lib/api/transforms.ts');

/** Read a page source file relative to the pages directory. */
function readPage(relativePath: string): string {
    return readFileSync(resolve(PAGES_DIR, relativePath), 'utf8');
}

/** Detail-page contract: every detail page MUST emit these. */
const DETAIL_PAGES: ReadonlyArray<{
    name: string;
    file: string;
    /** Typed JSON-LD component (SPEC-157 REQ-7 pattern) */
    typedComponent: string;
    extras?: ReadonlyArray<string>;
}> = [
    {
        name: 'accommodation detail',
        file: 'alojamientos/[slug].astro',
        typedComponent: 'LodgingBusinessJsonLd',
        // FAQPage emitted conditionally when faqs.length > 0
        extras: ['BreadcrumbJsonLd', 'FAQPageJsonLd']
    },
    {
        name: 'event detail',
        file: 'eventos/[slug].astro',
        typedComponent: 'EventJsonLd',
        extras: ['BreadcrumbJsonLd']
    },
    {
        name: 'destination detail',
        file: 'destinos/[...path].astro',
        typedComponent: 'PlaceJsonLd',
        extras: ['BreadcrumbJsonLd']
    },
    {
        name: 'post detail',
        file: 'publicaciones/[slug].astro',
        typedComponent: 'ArticleJsonLd',
        extras: ['BreadcrumbJsonLd']
    }
];

/** Pages that emit FAQPage JSON-LD because they render FAQ-like sections. */
const FAQ_PAGES: ReadonlyArray<{ name: string; file: string }> = [
    { name: 'cookies policy', file: 'legal/cookies/index.astro' },
    { name: 'privacy policy', file: 'legal/privacidad/index.astro' },
    { name: 'terms', file: 'legal/terminos/index.astro' }
];

/** Pages that emit AboutPage JSON-LD. */
const ABOUT_PAGES: ReadonlyArray<{ name: string; file: string }> = [
    { name: 'about us', file: 'nosotros/index.astro' },
    { name: 'benefits', file: 'beneficios/index.astro' }
];

/** Pages that emit Offer / PriceSpecification JSON-LD. */
const PRICING_PAGES: ReadonlyArray<{ name: string; file: string }> = [
    { name: 'tourist pricing', file: 'suscriptores/turistas/index.astro' },
    { name: 'owner pricing', file: 'suscriptores/planes/index.astro' }
];

describe('JSON-LD coverage across pages (SPEC-096 REQ-096-37)', () => {
    describe('Detail pages emit primary entity + breadcrumb JSON-LD', () => {
        for (const page of DETAIL_PAGES) {
            describe(page.name, () => {
                const src = readPage(page.file);

                it('renders <Breadcrumbs /> visually', () => {
                    expect(src).toContain('<Breadcrumbs');
                });

                it(`imports typed JSON-LD component ${page.typedComponent}`, () => {
                    // SPEC-157 REQ-7: detail pages MUST use the typed component,
                    // not the generic JsonLd with an inline schema object.
                    expect(src).toContain(
                        `import ${page.typedComponent} from '@/components/seo/${page.typedComponent}.astro'`
                    );
                });

                it(`mounts <${page.typedComponent} /> into the head-extra slot`, () => {
                    expect(src).toMatch(new RegExp(`<${page.typedComponent}\\b`));
                });

                it('imports BreadcrumbJsonLd', () => {
                    expect(src).toContain(
                        "import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd.astro'"
                    );
                });

                it('mounts <BreadcrumbJsonLd /> into the head-extra slot', () => {
                    expect(src).toMatch(/<BreadcrumbJsonLd[^>]*slot=["']head-extra["'][^>]*\/>/);
                });

                if (page.extras?.includes('FAQPageJsonLd')) {
                    it('imports FAQPageJsonLd for conditional emission', () => {
                        expect(src).toContain(
                            "import FAQPageJsonLd from '@/components/seo/FAQPageJsonLd.astro'"
                        );
                    });

                    it('renders FAQPageJsonLd when faqSections has items', () => {
                        // Conditional emission pattern: faqSections.length > 0
                        expect(src).toMatch(/faqSections\.length\s*>\s*0[\s\S]*?<FAQPageJsonLd/);
                    });
                }
            });
        }
    });

    describe('FAQ-like pages emit FAQPage JSON-LD', () => {
        for (const page of FAQ_PAGES) {
            it(`${page.name} imports + mounts FAQPageJsonLd`, () => {
                const src = readPage(page.file);
                expect(src).toContain(
                    "import FAQPageJsonLd from '@/components/seo/FAQPageJsonLd.astro'"
                );
                expect(src).toMatch(
                    /<FAQPageJsonLd[^>]*slot=["']head-extra["'][^>]*sections=\{[^}]+\}\s*\/>/
                );
            });
        }
    });

    describe('Marketing about-style pages emit AboutPage JSON-LD', () => {
        for (const page of ABOUT_PAGES) {
            it(`${page.name} imports + mounts AboutPageJsonLd`, () => {
                const src = readPage(page.file);
                expect(src).toContain(
                    "import AboutPageJsonLd from '@/components/seo/AboutPageJsonLd.astro'"
                );
                expect(src).toMatch(/<AboutPageJsonLd[\s\S]*?slot=["']head-extra["']/);
            });
        }
    });

    describe('Pricing pages emit Offer / PriceSpecification JSON-LD', () => {
        for (const page of PRICING_PAGES) {
            it(`${page.name} imports + mounts PriceSpecificationJsonLd`, () => {
                const src = readPage(page.file);
                expect(src).toContain(
                    "import PriceSpecificationJsonLd from '@/components/seo/PriceSpecificationJsonLd.astro'"
                );
                expect(src).toMatch(/<PriceSpecificationJsonLd[\s\S]*?plans=/);
            });
        }
    });

    describe('Schema.org shape sanity', () => {
        it('LodgingBusinessJsonLd component references schema.org context', () => {
            // The context is owned by the typed component, not the page.
            const componentSrc = readFileSync(
                resolve(__dirname, '../../src/components/seo/LodgingBusinessJsonLd.astro'),
                'utf8'
            );
            expect(componentSrc).toContain("'@context': 'https://schema.org'");
        });

        it('ArticleJsonLd component references schema.org context', () => {
            const componentSrc = readFileSync(
                resolve(__dirname, '../../src/components/seo/ArticleJsonLd.astro'),
                'utf8'
            );
            expect(componentSrc).toContain("'@context': 'https://schema.org'");
        });

        it('EventJsonLd component references schema.org context', () => {
            const componentSrc = readFileSync(
                resolve(__dirname, '../../src/components/seo/EventJsonLd.astro'),
                'utf8'
            );
            expect(componentSrc).toContain("'@context': 'https://schema.org'");
        });

        it('PlaceJsonLd component references schema.org context', () => {
            const componentSrc = readFileSync(
                resolve(__dirname, '../../src/components/seo/PlaceJsonLd.astro'),
                'utf8'
            );
            expect(componentSrc).toContain("'@context': 'https://schema.org'");
        });

        it('event detail maps cancelled → EventCancelled', () => {
            // EventStatus mapping lives in toEventDetailProps() in transforms.ts;
            // the page reads eventStatus from the transform result.
            const transforms = readFileSync(TRANSFORMS_FILE, 'utf8');
            expect(transforms).toContain("'EventCancelled'");
        });

        it('event detail maps rescheduled → EventRescheduled', () => {
            // EventStatus mapping lives in toEventDetailProps() in transforms.ts;
            // the page reads eventStatus from the transform result.
            const transforms = readFileSync(TRANSFORMS_FILE, 'utf8');
            expect(transforms).toContain("'EventRescheduled'");
        });

        it('event detail defaults to EventScheduled', () => {
            // EventStatus mapping lives in toEventDetailProps() in transforms.ts;
            // the page reads eventStatus from the transform result.
            const transforms = readFileSync(TRANSFORMS_FILE, 'utf8');
            expect(transforms).toContain("'EventScheduled'");
        });

        it('post detail: ArticleJsonLd component emits a publisher Organization', () => {
            // After SPEC-157 REQ-7, publisher is owned by ArticleJsonLd — not the page.
            const componentSrc = readFileSync(
                resolve(__dirname, '../../src/components/seo/ArticleJsonLd.astro'),
                'utf8'
            );
            expect(componentSrc).toMatch(/publisher:\s*\{/);
            expect(componentSrc).toMatch(/'@type':\s*'Organization'/);
        });

        it('destination detail: PlaceJsonLd component emits geo coordinates conditionally', () => {
            // After SPEC-157 REQ-7, geo is owned by PlaceJsonLd — not the page.
            const componentSrc = readFileSync(
                resolve(__dirname, '../../src/components/seo/PlaceJsonLd.astro'),
                'utf8'
            );
            // Accept either inline object literal `geo: {` or assignment `structuredData.geo = {`
            expect(componentSrc).toMatch(
                /(?:geo:\s*\{|structuredData\.geo\s*=\s*\{)[\s\S]*?'@type':\s*'GeoCoordinates'/
            );
        });
    });
});
