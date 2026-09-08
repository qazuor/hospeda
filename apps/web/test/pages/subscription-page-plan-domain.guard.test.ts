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
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/suscripcion/index.astro');
const SOURCE = readFileSync(PAGE_PATH, 'utf8');

/** The frontmatter alone — everything between the opening and closing `---`. */
const FRONTMATTER = SOURCE.slice(3, SOURCE.indexOf('\n---', 3));

describe('mi-cuenta/suscripcion — plan catalogue is fetched per product domain', () => {
    it('never calls fetchPublicPlans with no argument', () => {
        // The bug, spelled exactly: `await fetchPublicPlans()` served the
        // endpoint's `accommodation` default to the gastronomy and experience
        // dashboards too.
        expect(FRONTMATTER).not.toMatch(/fetchPublicPlans\(\s*\)/);
    });

    it('passes the resolved productDomain when the dashboard is a commerce one', () => {
        expect(FRONTMATTER).toMatch(
            /fetchPublicPlans\(\s*isCommerceDomain\s*\?\s*\{\s*domain:\s*productDomain\s*\}\s*:\s*\{\s*\}\s*\)/
        );
    });

    it('derives isCommerceDomain from productDomain, not from the caller roles', () => {
        // `hasAccommodationsNavAccess` still decides the accommodation
        // audience's category (owner vs tourist) and must not decide the domain:
        // a commerce owner holds no accommodation nav access, which is what
        // resolved the whole catalogue to `'tourist'`.
        expect(FRONTMATTER).toMatch(
            /const\s+isCommerceDomain\s*=\s*productDomain\s*!==\s*'accommodation'/
        );
    });

    it('keeps the accommodation catalogue empty on a commerce dashboard', () => {
        const slice = FRONTMATTER.slice(
            FRONTMATTER.indexOf('const availablePlans'),
            FRONTMATTER.indexOf('const commercePlans')
        );
        expect(slice).not.toHaveLength(0);
        expect(slice).toMatch(/!isCommerceDomain\s*&&\s*plansResult\.ok/);
        // Proves the slice actually cut — otherwise the assertion above could be
        // satisfied by a line belonging to the commerce branch.
        expect(slice).not.toContain('toCommercePlanOption');
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
