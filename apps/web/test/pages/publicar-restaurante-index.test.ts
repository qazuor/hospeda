/**
 * @file publicar-restaurante-index.test.ts
 * @description Source-read tests for the public gastronomy vertical landing
 * (HOS-690). Rebuilt from "hero + CommerceLead lead form" into a full
 * marketing page: hero, benefits, how-it-works, price, FAQ — the lead form is
 * gone from this page (retiring the underlying component/route is HOS-693).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicar-restaurante/index.astro'),
    'utf8'
);

describe('publicar-restaurante/index.astro', () => {
    it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
        expect(src).toContain('Astro.locals.locale');
        expect(src).not.toContain('Astro.params.lang');
    });

    it('uses createTranslations for i18n', () => {
        expect(src).toContain('createTranslations(locale)');
    });

    it('does NOT mount the CommerceLead island (HOS-690 removed the lead form)', () => {
        // The component itself is not deleted (HOS-693's job), so its name can
        // still appear in a doc comment explaining why — what must be gone is
        // the import and the JSX mount.
        expect(src).not.toContain("from '@/components/gastronomy/CommerceLead.client'");
        expect(src).not.toContain('<CommerceLead');
        expect(src).not.toContain('client:load');
    });

    it('no longer forwards the session or fetches destinations (HOS-690)', () => {
        expect(src).not.toContain('Astro.locals.user');
        expect(src).not.toContain('destinationsApi.list');
        expect(src).not.toContain('currentUser');
    });

    it('does NOT redirect unauthenticated visitors (public page)', () => {
        expect(src).not.toContain('if (!user)');
    });

    it('does NOT set prerender=true (must be SSR)', () => {
        expect(src).not.toContain('prerender = true');
    });

    it('uses the commerce.lead.* namespace for the hero (not commerce.plans.*)', () => {
        expect(src).toContain('commerce.lead.title');
        expect(src).not.toContain('commerce.plans');
    });

    it('fetches the gastronomy plan scoped by domain (HOS-685/HOS-690)', () => {
        expect(src).toContain('fetchPublicPlans');
        expect(src).toContain("domain: 'gastronomy'");
        expect(src).toContain('filterPlansByCategory');
    });

    it('is edge-cacheable via applyCacheHeaders with the pricing class (AC-37)', () => {
        expect(src).toContain('applyCacheHeaders');
        expect(src).toContain("cacheClass: 'pricing'");
        expect(src).toContain('CACHE_TAG_PRICING');
    });

    it('renders benefits, how-it-works, price and FAQ blocks', () => {
        expect(src).toContain('commerce.landing.gastronomy.benefits.title');
        expect(src).toContain('commerce.landing.gastronomy.howItWorks.title');
        expect(src).toContain('commerce.landing.gastronomy.price.title');
        expect(src).toContain('commerce.landing.gastronomy.faq.title');
    });

    it('degrades gracefully when the plan fetch fails', () => {
        expect(src).toContain('commerce.landing.gastronomy.price.unavailable');
    });

    it('renders a breadcrumb, BaseLayout and SEOHead', () => {
        expect(src).toContain('Breadcrumbs');
        expect(src).toContain('BaseLayout');
        expect(src).toContain('SEOHead');
    });

    it('uses CSS custom properties for spacing', () => {
        expect(src).toContain('var(--');
    });
});
