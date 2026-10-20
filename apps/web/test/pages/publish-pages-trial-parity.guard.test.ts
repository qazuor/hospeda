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
 *
 * ## The expired-trial banner left with the old billing (HOS-1637)
 *
 * All three pages read the visitor's trial from
 * `GET /protected/billing/trial/status`, a route the API no longer registers,
 * to render an expired-trial banner. That read and the banner were removed with
 * the old billing client (AC:B13a:21); the subscribe → publish leaf (V8a)
 * brings the trial state back on the new billing. This guard now pins that the
 * old read did not come back, alongside the accommodation callout wiring.
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
            'const showTrialCallout = shouldShowPublishTrialCallout({ isTrialExpired: false, trialEligibility });'
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

            it('declares its own vertical', () => {
                expect(src).toContain(`const VERTICAL = '${page.vertical}' as const;`);
            });

            it('no longer reads the trial from the old billing client, nor renders its expired banner (HOS-1637, AC:B13a:21)', () => {
                // Positive sibling: the page is read and is the right file.
                expect(src.length).toBeGreaterThan(500);
                expect(src).not.toContain('billingApi');
                expect(src).not.toContain('getTrialStatus');
                expect(src).not.toContain('billing.subscription.trial.expiredBanner');
                expect(src).not.toContain('publicar-hero__trial-expired');
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
