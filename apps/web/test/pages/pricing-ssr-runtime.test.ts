/**
 * @file pricing-ssr-runtime.test.ts
 * @description Source-reading tests verifying that the owner and tourist pricing
 * pages fetch plans from the public API endpoint at runtime (SSR) instead of
 * importing ALL_PLANS at build time (SPEC-168 T-016, D3).
 *
 * Astro pages cannot be rendered in Vitest/jsdom (sealed pattern — see
 * apps/web/CLAUDE.md "Testing"), so assertions target the page source text.
 *
 * The test suite verifies:
 * - Pages use SSR (`prerender = false`, no `getStaticPaths`).
 * - Pages import from `@/lib/billing/fetch-plans` (runtime helper).
 * - Pages do NOT import `ALL_PLANS` from `@repo/billing`.
 * - Cache-Control is set through `applyCacheHeaders`, declaring the `pricing`
 *   cache class and the `CACHE_TAG_PRICING` tag (HOS-426) — not by hand and
 *   not from local `PRICING_CACHE_*` constants, which were deleted once the
 *   TTL moved to `src/lib/cache/cache-classes.ts`.
 * - Plans are filtered by the correct category (`owner` / `tourist`).
 * - Fallback (empty array) is applied when `fetchResult.ok` is false.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ownerSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/planes/index.astro'),
    'utf8'
);

const touristSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/turistas/index.astro'),
    'utf8'
);

const helperSrc = readFileSync(resolve(__dirname, '../../src/lib/billing/fetch-plans.ts'), 'utf8');

// ---------------------------------------------------------------------------
// Owner pricing page
// ---------------------------------------------------------------------------

describe('Owner pricing page (suscriptores/planes/index.astro)', () => {
    describe('SSR rendering', () => {
        it('sets prerender = false (no SSG)', () => {
            expect(ownerSrc).toContain('export const prerender = false');
        });

        it('does NOT export getStaticPaths', () => {
            expect(ownerSrc).not.toContain('getStaticPaths');
        });

        it('does NOT import ALL_PLANS from @repo/billing', () => {
            expect(ownerSrc).not.toContain('ALL_PLANS');
            expect(ownerSrc).not.toContain("from '@repo/billing'");
        });
    });

    describe('runtime fetch', () => {
        it("imports fetchPublicPlans from '@/lib/billing/fetch-plans'", () => {
            expect(ownerSrc).toContain("from '@/lib/billing/fetch-plans'");
            expect(ownerSrc).toContain('fetchPublicPlans');
        });

        it('imports filterPlansByCategory from the fetch-plans helper', () => {
            expect(ownerSrc).toContain('filterPlansByCategory');
        });

        it('calls fetchPublicPlans at runtime', () => {
            expect(ownerSrc).toContain('await fetchPublicPlans()');
        });

        it("filters plans by 'owner' category", () => {
            expect(ownerSrc).toContain("filterPlansByCategory(fetchResult.plans, 'owner')");
        });

        it('falls back to empty array when fetchResult.ok is false', () => {
            expect(ownerSrc).toMatch(/fetchResult\.ok[\s\S]*?\[\]/);
        });
    });

    describe('cache headers (HOS-426)', () => {
        it('sets Cache-Control through applyCacheHeaders, not by hand', () => {
            expect(ownerSrc).toContain("from '@/lib/cache/response-cache'");
            expect(ownerSrc).toContain('applyCacheHeaders({');
            expect(ownerSrc).toContain('headers: Astro.response.headers');
            expect(ownerSrc).not.toContain('Astro.response.headers.set');
        });

        it('declares the `pricing` cache class', () => {
            expect(ownerSrc).toMatch(/cacheClass:\s*'pricing'/);
        });

        it('declares the CACHE_TAG_PRICING tag', () => {
            expect(ownerSrc).toContain("from '@repo/cache-tags'");
            expect(ownerSrc).toContain('CACHE_TAG_PRICING');
        });

        it('does NOT reference the deleted local pricing cache constants', () => {
            expect(ownerSrc).not.toContain('PRICING_CACHE_MAX_AGE_SECONDS');
            expect(ownerSrc).not.toContain('PRICING_CACHE_SWR_SECONDS');
        });
    });

    describe('template compatibility', () => {
        it('passes ownerPlans to PricingCardsGrid', () => {
            expect(ownerSrc).toContain('plans={ownerPlans}');
        });

        it('still renders JSON-LD when hasPlans is truthy', () => {
            expect(ownerSrc).toContain('{hasPlans && <PriceSpecificationJsonLd');
        });

        it('still renders the pricing cards section', () => {
            expect(ownerSrc).toContain('<PricingCardsGrid');
        });
    });
});

// ---------------------------------------------------------------------------
// Tourist pricing page
// ---------------------------------------------------------------------------

describe('Tourist pricing page (suscriptores/turistas/index.astro)', () => {
    describe('SSR rendering', () => {
        it('sets prerender = false (no SSG)', () => {
            expect(touristSrc).toContain('export const prerender = false');
        });

        it('does NOT export getStaticPaths', () => {
            expect(touristSrc).not.toContain('getStaticPaths');
        });

        it('does NOT import ALL_PLANS from @repo/billing', () => {
            expect(touristSrc).not.toContain('ALL_PLANS');
            expect(touristSrc).not.toContain("from '@repo/billing'");
        });
    });

    describe('runtime fetch', () => {
        it("imports fetchPublicPlans from '@/lib/billing/fetch-plans'", () => {
            expect(touristSrc).toContain("from '@/lib/billing/fetch-plans'");
            expect(touristSrc).toContain('fetchPublicPlans');
        });

        it('imports filterPlansByCategory from the fetch-plans helper', () => {
            expect(touristSrc).toContain('filterPlansByCategory');
        });

        it('calls fetchPublicPlans at runtime', () => {
            expect(touristSrc).toContain('await fetchPublicPlans()');
        });

        it("filters plans by 'tourist' category", () => {
            expect(touristSrc).toContain("filterPlansByCategory(fetchResult.plans, 'tourist')");
        });

        it('falls back to empty array when fetchResult.ok is false', () => {
            expect(touristSrc).toMatch(/fetchResult\.ok[\s\S]*?\[\]/);
        });
    });

    describe('cache headers (HOS-426)', () => {
        it('sets Cache-Control through applyCacheHeaders, not by hand', () => {
            expect(touristSrc).toContain("from '@/lib/cache/response-cache'");
            expect(touristSrc).toContain('applyCacheHeaders({');
            expect(touristSrc).toContain('headers: Astro.response.headers');
            expect(touristSrc).not.toContain('Astro.response.headers.set');
        });

        it('declares the `pricing` cache class', () => {
            expect(touristSrc).toMatch(/cacheClass:\s*'pricing'/);
        });

        it('declares the CACHE_TAG_PRICING tag', () => {
            expect(touristSrc).toContain("from '@repo/cache-tags'");
            expect(touristSrc).toContain('CACHE_TAG_PRICING');
        });

        it('does NOT reference the deleted local pricing cache constants', () => {
            expect(touristSrc).not.toContain('PRICING_CACHE_MAX_AGE_SECONDS');
            expect(touristSrc).not.toContain('PRICING_CACHE_SWR_SECONDS');
        });
    });

    describe('template compatibility', () => {
        it('passes touristPlans to PricingCardsGrid', () => {
            expect(touristSrc).toContain('plans={touristPlans}');
        });

        it('still renders JSON-LD when hasPlans is truthy', () => {
            expect(touristSrc).toContain('{hasPlans && <PriceSpecificationJsonLd');
        });

        it('still renders the pricing cards section', () => {
            expect(touristSrc).toContain('<PricingCardsGrid');
        });
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
