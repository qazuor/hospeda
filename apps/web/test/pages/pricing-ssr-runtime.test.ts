/**
 * @file pricing-ssr-runtime.test.ts
 * @description Source-reading tests over the FIVE `/planes/<audiencia>/precios/`
 * pages: that each reads its catalogue at request time (SSR) instead of
 * importing `ALL_PLANS` at build time (SPEC-168 T-016, D3), and that each
 * declares the edge-cache headers the middleware requires (HOS-426, HOS-941 R-5
 * / HOS-1032 AC-49).
 *
 * Astro pages cannot be rendered in Vitest/jsdom (sealed pattern — see
 * apps/web/CLAUDE.md "Testing"), so assertions target the page source text.
 *
 * ## Why a table and not two hand-written blocks
 *
 * This file used to spell the same twelve assertions out twice, once for the
 * owner page and once for the tourist one. HOS-1032 took the audience count from
 * two to five, and five copies of a block that already read as duplicated would
 * be how the sixth audience ships without any of them — the failure the cache
 * rule cannot afford, since a page that forgets `applyCacheHeaders` is REJECTED
 * by the middleware rather than merely uncached.
 *
 * The per-audience differences that remain are in `AUDIENCE_PAGES` itself: which
 * `fetchAudiencePlans` audience the page asks for, and whether it publishes a
 * `PriceSpecification` (aliados does not — it deliberately shows no amount, and
 * structured data naming one would publish the figure the page withholds).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = resolve(__dirname, '../../src/pages/[lang]');

/** One pricing page and the two things that are specific to it. */
interface AudiencePage {
    /** URL path under `src/pages/[lang]`, and the test's display name. */
    readonly path: string;
    /** The `AudienceCardId` its `fetchAudiencePlans` call must ask for. */
    readonly audienceId: string;
    /** The `PricingAudience` it hands the grid and the content resolver. */
    readonly pricingAudience: string;
    /** Whether the page emits `PriceSpecification` structured data. */
    readonly publishesPrice: boolean;
}

const AUDIENCE_PAGES: readonly AudiencePage[] = [
    {
        path: 'planes/anfitriones/precios',
        audienceId: 'host',
        pricingAudience: 'owner',
        publishesPrice: true
    },
    {
        path: 'planes/turistas/precios',
        audienceId: 'tourist',
        pricingAudience: 'tourist',
        publishesPrice: true
    },
    {
        path: 'planes/gastronomia/precios',
        audienceId: 'gastronomy',
        pricingAudience: 'gastronomy',
        publishesPrice: true
    },
    {
        path: 'planes/experiencias/precios',
        audienceId: 'experience',
        pricingAudience: 'experience',
        publishesPrice: true
    },
    {
        // HOS-941 D-13: no figure is published for aliados, so no
        // `PriceSpecification` either — it would put the amount into the field a
        // search result quotes, which is exactly what the visible page withholds.
        path: 'planes/aliados/precios',
        audienceId: 'partner',
        pricingAudience: 'partner',
        publishesPrice: false
    }
];

function readPage(path: string): string {
    return readFileSync(resolve(PAGES_ROOT, path, 'index.astro'), 'utf8');
}

const helperSrc = readFileSync(resolve(__dirname, '../../src/lib/billing/fetch-plans.ts'), 'utf8');

describe.each(AUDIENCE_PAGES)('$path', (page: AudiencePage) => {
    const src = readPage(page.path);

    describe('SSR rendering', () => {
        it('sets prerender = false (no SSG)', () => {
            expect(src).toContain('export const prerender = false');
        });

        it('does NOT export getStaticPaths', () => {
            expect(src).not.toContain('getStaticPaths');
        });

        it('does NOT import ALL_PLANS from @repo/billing', () => {
            // A build-time import would freeze the catalogue into the bundle, so
            // an operator's price edit in admin would need a redeploy to appear.
            expect(src).not.toContain('ALL_PLANS');
            expect(src).not.toContain("from '@repo/billing'");
        });
    });

    describe('runtime fetch', () => {
        it('reads its plans through fetchAudiencePlans', () => {
            expect(src).toContain("from '@/lib/billing/audience-plans'");
            expect(src).toContain('await fetchAudiencePlans(');
        });

        it('asks for its OWN audience', () => {
            expect(src).toContain(`fetchAudiencePlans({ audience: '${page.audienceId}' })`);
        });

        it('hands that same audience to the grid and the content resolver', () => {
            expect(src).toContain(`audience: '${page.pricingAudience}'`);
            expect(src).toContain(`audience="${page.pricingAudience}"`);
        });

        it('does NOT filter the catalogue itself', () => {
            // `fetchAudiencePlans` owns the selection, and two of its rules are
            // invisible at a call site: `complex` plans are never selected for
            // the host audience, and partner drops the still-active pre-tier
            // `partner-listing`. A page that re-filtered by hand would be a
            // second, subtly different copy of both.
            expect(src).not.toContain('filterPlansByCategory');
        });
    });

    describe('cache headers (HOS-426 / HOS-941 R-5)', () => {
        it('sets Cache-Control through applyCacheHeaders, not by hand', () => {
            expect(src).toContain("from '@/lib/cache/response-cache'");
            expect(src).toContain('applyCacheHeaders({');
            expect(src).toContain('headers: Astro.response.headers');
            expect(src).not.toContain('Astro.response.headers.set');
        });

        it('declares the `pricing` cache class', () => {
            expect(src).toMatch(/cacheClass:\s*'pricing'/);
        });

        it('declares the CACHE_TAG_PRICING tag', () => {
            // Without both the class and the tag the middleware REJECTS the
            // response — it is fail-closed, so this is not a missing
            // optimisation, it is a page that does not serve.
            expect(src).toContain("from '@repo/cache-tags'");
            expect(src).toContain('CACHE_TAG_PRICING');
        });

        it('does NOT reference the deleted local pricing cache constants', () => {
            expect(src).not.toContain('PRICING_CACHE_MAX_AGE_SECONDS');
            expect(src).not.toContain('PRICING_CACHE_SWR_SECONDS');
        });
    });

    describe('structure', () => {
        it('renders the shared sections component', () => {
            // AC-44: the five pages share structure and section order, which is
            // only true while they all go through the one component that
            // expresses it.
            expect(src).toContain('<AudiencePricingSections');
        });

        it('emits its billing FAQ as FAQPage structured data', () => {
            expect(src).toContain('buildBillingFaqJsonLd({ faqs })');
        });

        it('emits BreadcrumbList structured data beside its visible trail', () => {
            expect(src).toContain('<BreadcrumbJsonLd');
            expect(src).toContain('items={breadcrumbs.jsonLd}');
            expect(src).toContain('items={breadcrumbs.visible}');
        });

        it(
            page.publishesPrice
                ? 'publishes PriceSpecification structured data'
                : 'publishes NO PriceSpecification structured data',
            () => {
                // Both branches match the RENDERED tag (`<PriceSpecificationJsonLd`)
                // and not the bare name: aliados' docblock says at length why it
                // publishes none, and a page must stay free to explain what it
                // deliberately does not do.
                if (page.publishesPrice) {
                    expect(src).toContain('<PriceSpecificationJsonLd');
                } else {
                    expect(src).not.toContain('<PriceSpecificationJsonLd');
                    expect(src).not.toContain('import PriceSpecificationJsonLd');
                }
            }
        );
    });
});

// ---------------------------------------------------------------------------
// fetch-plans helper
// ---------------------------------------------------------------------------

describe('fetch-plans helper (src/lib/billing/fetch-plans.ts)', () => {
    it('exports fetchPublicPlans function', () => {
        expect(helperSrc).toContain('export async function fetchPublicPlans');
    });

    it('exports filterPlansByCategory function', () => {
        expect(helperSrc).toContain('export function filterPlansByCategory');
    });

    it('does NOT export pricing cache TTL constants (HOS-426: TTL moved to cache-classes.ts)', () => {
        expect(helperSrc).not.toContain('PRICING_CACHE_MAX_AGE_SECONDS');
        expect(helperSrc).not.toContain('PRICING_CACHE_SWR_SECONDS');
    });

    it('exports PublicPlanData interface', () => {
        expect(helperSrc).toContain('export interface PublicPlanData');
    });

    it('exports FetchPlansResult type', () => {
        expect(helperSrc).toContain('export type FetchPlansResult');
    });

    it('uses getApiUrl() to build the endpoint URL', () => {
        expect(helperSrc).toContain('getApiUrl()');
        expect(helperSrc).toContain('/api/v1/public/plans');
    });

    it('never throws — errors are returned as ok:false result', () => {
        // The function must be wrapped in try/catch — check for catch block
        expect(helperSrc).toContain('} catch (');
        expect(helperSrc).toContain('ok: false');
    });

    it('validates that the response body is an array before returning ok:true', () => {
        expect(helperSrc).toContain('Array.isArray(body)');
    });
});
