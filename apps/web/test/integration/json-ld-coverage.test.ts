/**
 * @file json-ld-coverage.test.ts
 * @description Integration test asserting that every detail page that
 * renders <Breadcrumbs /> also emits BreadcrumbList JSON-LD, and that
 * each detail page emits its primary entity JSON-LD plus any
 * page-specific structured data (FAQPage, AboutPage, Offer).
 *
 * SPEC-096 / REQ-096-37 (T-068).
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
    requiredType: string;
    extras?: ReadonlyArray<string>;
}> = [
    {
        name: 'accommodation detail',
        file: 'alojamientos/[slug].astro',
        requiredType: 'LodgingBusiness',
        // FAQPage emitted conditionally when faqs.length > 0
        extras: ['BreadcrumbJsonLd', 'FAQPageJsonLd']
    },
    {
        name: 'event detail',
        file: 'eventos/[slug].astro',
        requiredType: 'Event',
        extras: ['BreadcrumbJsonLd']
    },
    {
        name: 'destination detail',
        file: 'destinos/[...path].astro',
        requiredType: 'TouristDestination',
        extras: ['BreadcrumbJsonLd']
    },
    {
        name: 'post detail',
        file: 'publicaciones/[slug].astro',
        requiredType: 'BlogPosting',
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

                it(`emits an inline JSON-LD block of @type ${page.requiredType} (or a subtype thereof)`, () => {
                    // Detail pages assemble JSON-LD inline through the
                    // generic <JsonLd data={...} /> wrapper. Either the
                    // required @type appears literally OR a TYPE_MAP
                    // mapping for that family is present (accommodation
                    // maps to Hotel/Hostel/Motel/Resort/Campground).
                    const directType = src.includes(`'@type': '${page.requiredType}'`);
                    const subtypeMap =
                        page.requiredType === 'LodgingBusiness' &&
                        /TYPE_MAP\s*:\s*Readonly<Record<string,\s*string>>/.test(src);
                    expect(directType || subtypeMap).toBe(true);
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
        for (const page of DETAIL_PAGES) {
            it(`${page.name}: emitted JSON-LD references schema.org context`, () => {
                const src = readPage(page.file);
                expect(src).toContain("'@context': 'https://schema.org'");
            });
        }

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

        it('post detail emits a publisher Organization', () => {
            const src = readPage('publicaciones/[slug].astro');
            expect(src).toMatch(/publisher:\s*\{/);
            expect(src).toMatch(/'@type':\s*'Organization'/);
        });

        it('destination detail emits geo coordinates conditionally', () => {
            const src = readPage('destinos/[...path].astro');
            expect(src).toMatch(/geo:\s*\{[\s\S]*?'@type':\s*'GeoCoordinates'/);
        });
    });
});
