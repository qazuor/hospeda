/**
 * @file publish-pages-trial-parity.guard.test.ts
 * @description The three publish pages must mention the trial (HOS-1293).
 *
 * ## The bug this closes
 *
 * `/publicar/index.astro` (accommodation) had 52 references to `trial`: a
 * hero callout promising the free trial length, and an expired-trial banner.
 * `/publicar/gastronomia/` and `/publicar/experiencias/` had ZERO — even
 * though their own SALES landings (`/planes/gastronomia/`,
 * `/planes/experiencias/`) already promise a free trial one click away. A
 * gastronomy or experience owner who reached the publish form directly never
 * saw the promise their own funnel had just made them.
 *
 * ## What this guard checks, and why source-level is enough here
 *
 * A `.astro` source test cannot tell a DECLARED trial block from a RENDERED
 * one — it cannot execute `shouldShowPublishTrialCallout`'s branches. That is
 * exactly why `publish-trial-callout.test.ts` exists: it exercises the pure
 * decision function's real branches (expired / eligible / ineligible /
 * unresolved) with real inputs. What THIS guard adds is the one thing that
 * unit test cannot see — that all three pages actually WIRE that function
 * in, scoped to their own vertical's trial status. Deleting the import, or
 * hardcoding `productDomain` to `'accommodation'` on the commerce pages,
 * would regress the exact bug HOS-1293 reports while `publish-trial-callout.test.ts`
 * stayed fully green (it never touches these page files).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The three publish pages and the vertical each one publishes. */
const PUBLISH_PAGES: ReadonlyArray<{
    readonly route: string;
    readonly file: string;
    readonly vertical: string;
}> = [
    { route: '/{lang}/publicar/', file: 'publicar/index.astro', vertical: 'accommodation' },
    {
        route: '/{lang}/publicar/gastronomia/',
        file: 'publicar/gastronomia/index.astro',
        vertical: 'gastronomy'
    },
    {
        route: '/{lang}/publicar/experiencias/',
        file: 'publicar/experiencias/index.astro',
        vertical: 'experience'
    }
];

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

function readPage(file: string): string {
    return readFileSync(resolve(PAGES_DIR, file), 'utf8');
}

describe('HOS-1293 — every publish page mentions the trial it may grant', () => {
    for (const page of PUBLISH_PAGES) {
        describe(page.route, () => {
            const src = readPage(page.file);

            it('imports the shared trial-callout decision function', () => {
                // The SAME pure function on all three — never a re-derived,
                // possibly-divergent copy of the isExpired/eligible logic.
                expect(src).toContain(
                    "import { shouldShowPublishTrialCallout } from '@/lib/host/publish-trial-callout';"
                );
                expect(src).toContain('shouldShowPublishTrialCallout(');
            });

            it("fetches its OWN vertical's trial status, not a hardcoded default", () => {
                // Regression guard for HOS-1282's own bug, reproduced at this
                // vertical: an unscoped getTrialStatus() call resolves the
                // server's domain-blind default, which is accommodation. A
                // commerce page calling it unscoped would silently read the
                // wrong (or a dual-role owner's unrelated) subscription.
                expect(src).toContain(
                    `billingApi.getTrialStatus({ cookieHeader, productDomain: VERTICAL })`
                );
                expect(src).toContain(`const VERTICAL = '${page.vertical}' as const;`);
            });

            it('renders the expired-trial banner, reusing the shared billing.subscription.trial.expiredBanner.* copy', () => {
                // Reused verbatim across all three verticals — the sentence
                // ("Suscribite para volver a publicar") is vertical-agnostic,
                // so this is deliberate reuse, not an oversight that a
                // gastronomy/experience-specific banner should replace.
                expect(src).toContain('billing.subscription.trial.expiredBanner.title');
                expect(src).toContain('billing.subscription.trial.expiredBanner.body');
                expect(src).toContain('billing.subscription.trial.expiredBanner.cta');
            });
        });
    }

    it('the two commerce pages promise a trial length read from their own catalogue, never a hardcoded number', () => {
        // H-98/HOS-525: the number in the callout must come from
        // `billing_plans.metadata.trialDays` through the catalogue, exactly
        // like the sales landing (`resolveCommerceLandingOffer`) — never a
        // hardcoded string that can drift from what checkout actually grants.
        for (const page of [PUBLISH_PAGES[1], PUBLISH_PAGES[2]]) {
            const src = readPage((page as (typeof PUBLISH_PAGES)[number]).file);
            expect(src).toContain(
                "import { resolveCommerceLandingOffer } from '@/lib/billing/commerce-landing-plan';"
            );
            expect(src).toContain('resolveCommerceLandingOffer({ plansResult })');
            // Never invented: the callout must be gated on trialDays !== null.
            expect(src).toContain('trialDays !== null');
        }
    });
});
