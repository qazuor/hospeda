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
 * in, scoped to their own vertical's trial status AND eligibility. Deleting
 * the import, or hardcoding `productDomain` to `'accommodation'` on the
 * gastronomy/experience pages' `getTrialStatus`/`getTrialEligibility` calls, would regress
 * the exact bug HOS-1293 reports while `publish-trial-callout.test.ts` stayed
 * fully green (it never touches these page files).
 *
 * ## Gastronomy and experience lost their callout (HOS-1418)
 *
 * The "probá gratis" callout on the two vertical pages read its trial length
 * from the old plan catalogue (`GET /public/plans`), which no longer exists.
 * With no source of truth for the number, those two pages promise nothing: they
 * keep the expired-trial banner, scoped to their own vertical, and this guard
 * pins that the retired catalogue read did not come back.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The three publish pages and the vertical each one publishes. */
const PUBLISH_PAGES: ReadonlyArray<{
    readonly route: string;
    readonly file: string;
    readonly vertical: string;
    /**
     * The EXACT `showTrialCallout` assignment this page's source must
     * contain, verbatim (HOS-1293 mutation hardening — see the "computed,
     * not just present" test below for why this exists).
     */
    readonly trialCalloutWiring: string | null;
}> = [
    {
        route: '/{lang}/publicar/',
        file: 'publicar/index.astro',
        vertical: 'accommodation',
        trialCalloutWiring:
            'const showTrialCallout = shouldShowPublishTrialCallout({ isTrialExpired, trialEligibility });'
    },
    {
        route: '/{lang}/publicar/gastronomia/',
        file: 'publicar/gastronomia/index.astro',
        vertical: 'gastronomy',
        trialCalloutWiring: null
    },
    {
        route: '/{lang}/publicar/experiencias/',
        file: 'publicar/experiencias/index.astro',
        vertical: 'experience',
        trialCalloutWiring: null
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

            it.skipIf(page.trialCalloutWiring === null)(
                'imports the shared trial-callout decision function',
                () => {
                    // The SAME pure function on all three — never a re-derived,
                    // possibly-divergent copy of the isExpired/eligible logic.
                    expect(src).toContain(
                        "import { shouldShowPublishTrialCallout } from '@/lib/host/publish-trial-callout';"
                    );
                    expect(src).toContain('shouldShowPublishTrialCallout(');
                }
            );

            it.skipIf(page.trialCalloutWiring === null)(
                'shows the callout ONLY when it is actually computed by that call — not hardcoded, not discarded (HOS-1293 mutation hardening)',
                () => {
                    // The test above is a `toContain` over the whole file: it is
                    // satisfied by the call appearing ANYWHERE, including inside a
                    // dead/discarded expression left in place purely to keep the
                    // string present. Measured: a mutation that keeps the call
                    // (`if (trialDays !== null) { shouldShowPublishTrialCallout(...); }`)
                    // but hardcodes `const showTrialCallout = true;` right after it
                    // passed every other assertion in this file — the callout would
                    // over-promise a trial to an already-ineligible visitor, and
                    // nothing here said so. This pins the exact assignment
                    // expression, so `showTrialCallout` must be bound to the real
                    // call's result, not merely share a file with it.
                    expect(src).toContain(page.trialCalloutWiring ?? '');
                }
            );

            it("fetches its OWN vertical's trial status, not a hardcoded default", () => {
                // Regression guard for HOS-1282's own bug, reproduced at this
                // vertical: an unscoped getTrialStatus() call resolves the
                // server's domain-blind default, which is accommodation. A
                // gastronomy/experience page calling it unscoped would silently read the
                // wrong (or a dual-role owner's unrelated) subscription.
                // Whitespace-tolerant: the formatter may wrap the argument object.
                expect(src).toMatch(
                    /billingApi\.getTrialStatus\(\{\s*cookieHeader,\s*productDomain:\s*VERTICAL\s*\}\)/
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

    it('the two vertical pages no longer read the retired plan catalogue or promise a trial length', () => {
        // The callout's number came from `GET /public/plans`, which is gone.
        // Nothing may bring back a hardcoded figure in its place (HOS-525).
        for (const page of [PUBLISH_PAGES[1], PUBLISH_PAGES[2]]) {
            const src = readPage((page as (typeof PUBLISH_PAGES)[number]).file);
            expect(src).not.toContain('fetchPublicPlans');
            expect(src).not.toContain('shouldShowPublishTrialCallout');
            expect(src).not.toContain('trialDays');
            expect(src).not.toContain('getTrialEligibility');
        }
    });
});
