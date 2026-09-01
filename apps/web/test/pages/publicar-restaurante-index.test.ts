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
        // HOS-941 R-2: the page no longer selects the plan itself. The
        // selection moved into `resolveCommerceLandingOffer`, which returns
        // the plan AND its trial length from that one response, so the
        // price and the trial cannot come to describe different plans.
        expect(src).toContain('resolveCommerceLandingOffer');
        expect(src).not.toContain('filterPlansByCategory');
    });

    it('takes the trial length from the plan, never from the copy (HOS-941 R-2)', () => {
        // `tPlural` + the plan's `trialDays`, not `t` over a string that
        // spelled the number out. The locale side of this rule is held by
        // `packages/i18n/test/trial-days-not-hardcoded.guard.test.ts`.
        expect(src).toContain('tPlural');
        expect(src).toContain("tPlural('commerce.landing.gastronomy.price.trial', trialDays)");
        expect(src).toContain("tPlural('commerce.landing.gastronomy.faq.a1', trialDays)");
    });

    it('never passes a hardcoded day count to the trial copy', () => {
        // The failure this forbids is subtle: every locale string could be
        // a correct `{{count}}` template and the page could still print a
        // frozen 30 by interpolating a literal.
        expect(src).not.toMatch(/tPlural\([^)]*trial[^)]*,\s*\d+\s*\)/i);
        expect(src).not.toMatch(/tPlural\([^)]*faq\.a1[^)]*,\s*\d+\s*\)/i);
    });

    it('renders no trial line at all when the plan offers none', () => {
        // `trialLabel` is null for a failed fetch AND for a plan with no
        // trial, and both must render as nothing — never "0 días", never a
        // number inherited from the other vertical. The old code keyed the
        // paragraph off `plan.hasTrial` and then printed a constant string,
        // which could not express either case.
        expect(src).toContain('{trialLabel && (');
        expect(src).not.toContain('.hasTrial &&');
        // The trial-free FAQ answer is its own written sentence, not the
        // trial one with a clause cut out of the middle.
        expect(src).toContain('commerce.landing.gastronomy.faq.a1NoTrial');
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
