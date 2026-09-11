/**
 * @file comparar.test.ts
 * @description The comparison table stopped having a URL of its own
 * (HOS-941 D-4 + D-11, landed by HOS-1032). It now renders INLINE, under the
 * cards, on every `/planes/<audiencia>/precios/` page — via
 * `AudiencePricingSections.astro`, the one component all five pricing pages
 * share. `suscriptores/planes/comparar/index.astro` and
 * `suscriptores/turistas/comparar/index.astro` are what is left at the old
 * URLs: permanent redirects to the pricing page that now carries the table.
 *
 * This file used to assert two near-identical full pages (fetch, hero,
 * layout, cache headers, CTA). All of that content-level coverage now lives
 * on the shared component and the five pricing pages
 * (`test/pages/pricing-ssr-runtime.test.ts` covers SSR/cache/structure across
 * all five; `AudiencePricingSections.astro`'s own tests below cover the
 * comparison table specifically). What is left as a property of THESE two
 * files is that they redirect, and where to.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ownerRedirectSrc = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/suscriptores/planes/comparar/index.astro'),
    'utf8'
);

const touristRedirectSrc = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/suscriptores/turistas/comparar/index.astro'),
    'utf8'
);

const sectionsSrc = readFileSync(
    resolve(__dirname, '../../../src/components/billing/AudiencePricingSections.astro'),
    'utf8'
);

describe('Owner comparison URL (suscriptores/planes/comparar/index.astro)', () => {
    it('renders on demand, so the redirect is actually executed', () => {
        expect(ownerRedirectSrc).toContain('prerender = false');
    });

    it('redirects rather than serving a 200 body', () => {
        // Catches a regression back to a rendered comparison page: no
        // layout, no hero, no plan fetch — just the redirect statement.
        expect(ownerRedirectSrc).toContain('return Astro.redirect(');
        expect(ownerRedirectSrc).not.toContain('MarketingLayout');
        expect(ownerRedirectSrc).not.toContain('<PlanComparisonTable');
        expect(ownerRedirectSrc).not.toContain('filterPlansByCategory');
    });

    it('answers 301 at the owner pricing page, where the table now lives', () => {
        expect(ownerRedirectSrc).toMatch(/Astro\.redirect\([\s\S]*?,\s*301\s*\)/);
        expect(ownerRedirectSrc).toContain('PRICING_PAGE_PATH_BY_AUDIENCE.owner');
    });
});

describe('Tourist comparison URL (suscriptores/turistas/comparar/index.astro)', () => {
    it('renders on demand, so the redirect is actually executed', () => {
        expect(touristRedirectSrc).toContain('prerender = false');
    });

    it('redirects rather than serving a 200 body', () => {
        expect(touristRedirectSrc).toContain('return Astro.redirect(');
        expect(touristRedirectSrc).not.toContain('MarketingLayout');
        expect(touristRedirectSrc).not.toContain('PlanComparisonTable');
        expect(touristRedirectSrc).not.toContain('filterPlansByCategory');
    });

    it('answers 301 at the tourist pricing page, where the table now lives', () => {
        expect(touristRedirectSrc).toMatch(/Astro\.redirect\([\s\S]*?,\s*301\s*\)/);
        expect(touristRedirectSrc).toContain('PRICING_PAGE_PATH_BY_AUDIENCE.tourist');
    });
});

describe('AudiencePricingSections.astro renders the comparison table inline', () => {
    it('imports PlanComparisonTable', () => {
        expect(sectionsSrc).toContain(
            "import PlanComparisonTable from '@/components/billing/PlanComparisonTable.astro'"
        );
    });

    it('gates the table on hasComparison, so a failed/empty catalogue renders none', () => {
        // `hasComparison` already requires `plans.length > 0` (see
        // `resolvePricingPageContent`), so an audience whose fetch failed
        // gets no half-built table rather than a header row with nothing
        // under it — there is no separate EmptyState fallback to test here.
        expect(sectionsSrc).toContain('{hasComparison && comparisonAudience && (');
    });

    it('narrows the audience prop, refusing to render for partner', () => {
        // `PlanComparisonTable` types its `audience` prop without `'partner'`
        // (aliados has no curated rows to compare). Narrowing HERE rather
        // than passing `audience` straight through is what stops a future
        // `hasComparison` becoming true for aliados from silently rendering
        // the accommodation comparison rows under partner's columns.
        expect(sectionsSrc).toContain(
            "const comparisonAudience = audience === 'partner' ? null : audience;"
        );
    });

    it('forwards the same plans, locale, intlLocale and CTA href the cards use', () => {
        // One resolved set of props feeds both the grid and the table, so
        // they cannot describe two different catalogues.
        expect(sectionsSrc).toContain('plans={plans}');
        expect(sectionsSrc).toContain('audience={comparisonAudience}');
        expect(sectionsSrc).toContain('intlLocale={intlLocale}');
        expect(sectionsSrc).toContain('ctaHref={ctaHref}');
    });

    it('uses CSS custom properties for the section heading', () => {
        expect(sectionsSrc).toContain('var(--');
    });
});
