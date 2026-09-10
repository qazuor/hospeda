/**
 * @file subscription-page-plan-domain.guard.test.ts
 * @description Static guard over `mi-cuenta/suscripcion/index.astro`'s plan
 * fetch (HOS-1213).
 *
 * ## Why a source guard and not a render test
 *
 * `.astro` frontmatter is not renderable under Vitest, and this page returns
 * early (`Astro.redirect` for a signed-out visitor) before the code under
 * examination — which `astro check` does not typecheck past either. So the
 * property has to be asserted over the source.
 *
 * The realistic regression is narrow and mechanical: somebody drops the
 * argument and `fetchPublicPlans()` goes back to serving the accommodation
 * default to all three dashboards. That is what these assertions are anchored
 * on, and each one is scoped to a slice of the file rather than to the whole of
 * it — an assertion over the entire source passes as long as SOME line matches,
 * which for a one-call file would be exactly the bug.
 *
 * The behaviour these protect is exercised for real in
 * `test/components/account/SubscriptionDashboard.commerce-domain.test.tsx`.
 *
 * ## Re-anchored on the property, not on the expression (HOS-1321)
 *
 * Three of these used to quote the page's exact expressions —
 * `productDomain !== 'accommodation'`, `fetchPublicPlans(isCommerceDomain ? …)`.
 * That froze one spelling of a decision instead of guarding the decision, and it
 * fired on the change that made the page MORE correct: adding `tourist` to
 * `SUBSCRIPTION_DASHBOARD_DOMAINS` turned that negation into a live bug (it
 * classifies the tourist dashboard as a commerce vertical), so removing it was
 * the fix, and the guard called the fix a regression.
 *
 * They now assert what HOS-1213 actually needs — the catalogue follows the
 * resolved DOMAIN and never the caller's roles — by requiring the decision to
 * come from `resolveDashboardPlanSource`, whose own exhaustive mapping is
 * unit-tested in `test/lib/billing/subscription-domain.test.ts`. A future domain
 * fails there, in a real test, instead of here against a string.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/suscripcion/index.astro');
const SOURCE = readFileSync(PAGE_PATH, 'utf8');

/** The frontmatter alone — everything between the opening and closing `---`. */
const FRONTMATTER = SOURCE.slice(3, SOURCE.indexOf('\n---', 3));

/**
 * The frontmatter with comments removed.
 *
 * Required by every NEGATIVE assertion here. This page documents the shapes it
 * deliberately does NOT use — "the tourist dashboard PINS its category instead
 * of deferring to roles", "this used to be `productDomain !== 'accommodation'`"
 * — so a `not.toMatch` over the raw source fires on the explanation of the fix
 * rather than on the fix. A positive assertion can safely read the raw text (a
 * comment cannot satisfy one by accident and then also be the code); a negative
 * one cannot.
 */
const FRONTMATTER_CODE = FRONTMATTER.replace(/\/\*[\s\S]*?\*\//g, '').replace(
    /^[^\n'"`]*\/\/.*$/gm,
    ''
);

describe('mi-cuenta/suscripcion — plan catalogue is fetched per product domain', () => {
    it('drives the catalogue fetch from the resolved domain, in every branch', () => {
        // ## Why this replaced "never calls fetchPublicPlans with no argument"
        //
        // That assertion was escapable by SPELLING, and HOS-1321 escaped it
        // without meaning to: `fetchPublicPlans({})` is not `fetchPublicPlans()`,
        // so the guard stayed green while the defect it names came back — the
        // tourist tab fetching the endpoint's accommodation default and getting
        // a catalogue with no tourist tiers in it (they carry
        // `product_domain = 'tourist'` since HOS-1233, and `listPlans.ts`
        // excludes every out-of-domain plan). Two characters defeated it.
        //
        // Anchored on the EFFECT instead: the only argument this call may be
        // given is the domain `resolveDashboardPlanSource` resolved. A bare
        // `()`, a literal `{}`, a hardcoded domain and a role-derived one all
        // fail, because none of them is that expression.
        const slice = FRONTMATTER.slice(
            FRONTMATTER.indexOf('const plansResult'),
            FRONTMATTER.indexOf('const availablePlans')
        );
        expect(slice).not.toHaveLength(0);
        expect(slice).toMatch(/fetchPublicPlans\(/);
        expect(slice).toMatch(
            /fetchPublicPlans\(\s*planSource\.planDomain\s*\?\s*\{\s*domain:\s*planSource\.planDomain\s*\}\s*:\s*\{\s*\}\s*\)/
        );
        // Nothing else in the page may fetch a catalogue behind this one's back.
        expect(FRONTMATTER_CODE.match(/fetchPublicPlans\(/g)).toHaveLength(1);
    });

    it('derives the catalogue choice from the resolved domain, not from the caller roles', () => {
        // `hasAccommodationsNavAccess` still decides the accommodation
        // audience's category (owner vs tourist) and must not decide the domain:
        // a commerce owner holds no accommodation nav access, which is what
        // resolved the whole catalogue to `'tourist'` (HOS-1213).
        //
        // Asserted as "comes from `resolveDashboardPlanSource`, given the
        // resolved domain" rather than by quoting an expression: that helper is
        // the exhaustive mapping, unit-tested per domain, and it is what makes a
        // fifth domain a compile error instead of a silent commerce dashboard.
        expect(FRONTMATTER).toMatch(
            /const\s+planSource\s*=\s*resolveDashboardPlanSource\(\{\s*domain:\s*productDomain\s*\}\)/
        );
        expect(FRONTMATTER).toMatch(
            /const\s+isCommerceDomain\s*=\s*planSource\.flow\s*===\s*'commerce'/
        );

        // And the roles are nowhere in that decision — only in the category.
        const domainDecision = FRONTMATTER_CODE.slice(
            FRONTMATTER_CODE.indexOf('const planSource'),
            FRONTMATTER_CODE.indexOf('const planCategory')
        );
        expect(domainDecision).not.toHaveLength(0);
        expect(domainDecision).not.toContain('hasAccommodationsNavAccess');
        expect(domainDecision).not.toContain('roles');
    });

    it('HOS-1321: tourist is never treated as a commerce vertical', () => {
        // The negation this replaced (`productDomain !== 'accommodation'`) sent
        // the tourist dashboard down the commerce path: a `?domain=tourist`
        // catalogue that does not exist, and a POST to
        // `/protected/commerce/tourist/change-plan`. The page must not grow a
        // second, hand-rolled domain comparison alongside the helper.
        expect(FRONTMATTER_CODE).not.toMatch(/productDomain\s*!==\s*'accommodation'/);
        expect(FRONTMATTER_CODE).not.toMatch(/productDomain\s*===\s*'tourist'/);
        // The comment stripper must actually have cut, or both assertions above
        // are vacuous on a file whose comments discuss those exact shapes.
        expect(FRONTMATTER_CODE.length).toBeLessThan(FRONTMATTER.length);
        expect(FRONTMATTER_CODE).toContain('const planSource');
    });

    it('keeps the accommodation catalogue empty on a commerce dashboard', () => {
        const slice = FRONTMATTER.slice(
            FRONTMATTER.indexOf('const availablePlans'),
            FRONTMATTER.indexOf('const commercePlans')
        );
        expect(slice).not.toHaveLength(0);
        expect(slice).toMatch(/!isCommerceDomain\s*&&/);
        expect(slice).toMatch(/plansResult\.ok/);
        // Proves the slice actually cut — otherwise the assertion above could be
        // satisfied by a line belonging to the commerce branch.
        expect(slice).not.toContain('toCommercePlanOption');
    });

    it('HOS-1321: the accommodation catalogue is also gated on the plan-change guard', () => {
        // `POST /billing/subscriptions/change-plan` resolves its row
        // accommodation-first, so a holder of both an accommodation AND a
        // tourist subscription must not be offered tourist tiers on their
        // tourist tab — the call would mutate the owner subscription. An empty
        // list is what degrades the dashboard to the "Ver planes" link.
        const slice = FRONTMATTER.slice(
            FRONTMATTER.indexOf('const availablePlans'),
            FRONTMATTER.indexOf('const commercePlans')
        );
        expect(slice).toMatch(/canOfferPlanChange/);
        expect(FRONTMATTER).toMatch(
            /const\s+canOfferPlanChange\s*=\s*!planChangeWouldResolveAnotherSubscription\(/
        );
        // Fed the three-state reading, never `heldDomains`. That list drops a
        // domain whose read FAILED, so feeding it here would let a 500 on the
        // accommodation fetch read as "they have no accommodation subscription"
        // and hand a dual holder a plan change aimed at their owner row — the
        // guard re-opened by the failure mode of its own input.
        const guardCall = FRONTMATTER_CODE.slice(
            FRONTMATTER_CODE.indexOf('const canOfferPlanChange'),
            FRONTMATTER_CODE.indexOf('const availablePlans')
        );
        expect(guardCall).not.toHaveLength(0);
        expect(guardCall).toContain('accommodationSubscription');
        expect(guardCall).not.toContain('heldDomains');
    });

    it('builds the commerce catalogue only on a commerce dashboard', () => {
        const slice = FRONTMATTER.slice(FRONTMATTER.indexOf('const commercePlans'));
        expect(slice).not.toHaveLength(0);
        expect(slice).toMatch(/isCommerceDomain\s*&&\s*plansResult\.ok/);
        expect(slice).toMatch(/filterPlansByCategory\(\s*plansResult\.plans,\s*'owner'\s*\)/);
        expect(slice).toContain('toCommercePlanOption');
    });

    it('hands both catalogues to the dashboard island', () => {
        const markup = SOURCE.slice(SOURCE.indexOf('<SubscriptionDashboard'));
        expect(markup).toMatch(/plans=\{availablePlans\}/);
        expect(markup).toMatch(/commercePlans=\{commercePlans\}/);
        expect(markup).toMatch(/productDomain=\{productDomain\}/);
    });
});
