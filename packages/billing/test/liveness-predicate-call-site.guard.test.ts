/**
 * @file liveness-predicate-call-site.guard.test.ts
 * @description HOS-1310, scope item 3: a guard against a FOURTH copy of the
 * liveness rule, plus a pin on the two vertical gates whose disagreement is what
 * the issue reports.
 *
 * ## Part 1 — every predicate in this directory normalizes its input
 *
 * `billing_subscriptions.status` holds two vocabularies (see
 * `subscription-status-normalize.ts`). A predicate that compares the raw value
 * against Hospeda-vocabulary literals is blind to qzpay's spellings, and fails
 * SILENTLY: `isLiveSubscriptionStatus('unpaid')` simply answered `false`, with no
 * error and no log, for a state the repo's own map calls `past_due`.
 *
 * **The roots are derived, not listed.** The scan reads this directory, so a
 * fourth predicate added next door is covered the moment the file lands — the
 * failure mode of a hand-typed file list is precisely what HOS-1311 is about, and
 * it is not worth reproducing here in miniature. Every module is in scope; the two
 * that legitimately compare nothing are named in {@link EXEMPT_MODULES} with the
 * reason, and two further cases assert that list has not rotted. Deciding
 * membership from the export's NAME instead would look like a derivation and be a
 * hole: a predicate called `isOwnerPaying` would match no name pattern and be
 * skipped with the guard reporting a pass.
 *
 * ## Part 2 — the two gates HOS-1310 names still disagree, visibly
 *
 * These two resolve the same question — "is this listing covered by what its
 * owner pays for?" — through different predicates, which is the asymmetry the
 * issue exists to surface:
 *
 * - commerce: `reconcileCommerceListingVisibility` → `isEntitlementGrantingStatus`
 * - accommodation: `checkEligibility` → `isSubscriptionLive`
 *
 * Unifying them is a product decision and is deliberately NOT made here. What
 * this part buys is that the decision cannot be made by accident: change either
 * side and this test says so, naming the other.
 *
 * **What Part 2 does NOT prove.** It is a source-text assertion. It proves the
 * named file imports and mentions the named predicate — not that the predicate
 * decides the outcome, and not that no OTHER file in either vertical decides
 * liveness some third way. Two specific limits worth stating because a reader
 * will otherwise assume they are covered:
 *
 * - It checks two files. It is not a repo scan.
 * - The repo's existing scan for hand-rolled status sets
 *   (`apps/api/test/services/billing-status-gate-canonical-predicate.guard.test.ts`)
 *   roots itself at `apps/api/src` alone, so `packages/service-core/src` — where
 *   the commerce half of this very pair lives — is outside it. Widening that
 *   root is HOS-1311's subject, not this file's.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PREDICATES_DIR = resolve(__dirname, '../src/predicates');
const REPO_ROOT = resolve(__dirname, '../../..');

/** The normalizer every status-taking predicate must route through. */
const NORMALIZER = 'normalizeStoredSubscriptionStatus';

/**
 * The only two modules in this directory exempt from Part 1, each with the reason.
 *
 * **This list is the guard's sole escape hatch, and it is deliberately a list and
 * not a rule.** An earlier cut of this file decided membership from the export's
 * NAME instead — `/export function is…(Status|Live)/` — which reads like a
 * derivation and is really a hole: a fourth predicate called `isOwnerPaying` or
 * `subscriptionCounts` matches nothing, skips the assertion, and the guard
 * reports a pass. Requiring every module and naming the exceptions puts the
 * burden on whoever adds the next file, which is where it belongs.
 */
const EXEMPT_MODULES: ReadonlyArray<{ readonly file: string; readonly why: string }> = [
    {
        file: 'index.ts',
        why: 'The barrel. It only re-exports; it compares no status and has nothing to normalize.'
    },
    {
        file: 'subscription-status-normalize.ts',
        why: 'It IS the normalizer. Requiring it to call itself is circular.'
    }
];

const EXEMPT_FILE_NAMES: ReadonlySet<string> = new Set(EXEMPT_MODULES.map((entry) => entry.file));

/** Strip comments so a docblock that merely MENTIONS the normalizer cannot satisfy the guard. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Every `.ts` module in `src/predicates` that is not explicitly exempt. */
function predicateModules(): readonly string[] {
    return readdirSync(PREDICATES_DIR)
        .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
        .filter((name) => !EXEMPT_FILE_NAMES.has(name))
        .sort();
}

describe('HOS-1310 Part 1: every liveness predicate normalizes the stored status', () => {
    it('finds predicate modules at all — the derived scan is not empty', () => {
        // Without this, a rename of the directory or of the file extension would
        // turn every assertion below into a vacuous pass over zero files.
        const modules = predicateModules();
        expect(modules.length).toBeGreaterThanOrEqual(3);
        expect(modules).toContain('is-entitlement-granting-status.ts');
        expect(modules).toContain('is-live-subscription-status.ts');
        expect(modules).toContain('is-subscription-live.ts');
    });

    it('every exempt module still exists — a rename must not blindfold the scan', () => {
        /*
         * An exemption list rots in two directions. Rename `index.ts` and its entry
         * silently stops matching anything; worse, rename a PREDICATE to a name the
         * list happens to carry and it is exempted for free. Both end with a guard
         * that checks less than it claims.
         */
        const present = new Set(readdirSync(PREDICATES_DIR));
        const missing = EXEMPT_MODULES.filter((entry) => !present.has(entry.file)).map(
            (entry) => entry.file
        );
        expect(
            missing,
            `These files are exempt from the normalization requirement but no longer exist:\n${missing
                .map((f) => `  - ${f}`)
                .join('\n')}\nRemove the entry so the scan covers whatever replaced them.`
        ).toEqual([]);
    });

    it('no exemption is undocumented', () => {
        const unexplained = EXEMPT_MODULES.filter((entry) => entry.why.trim().length < 40).map(
            (entry) => entry.file
        );
        expect(
            unexplained,
            `Every exemption needs a real reason, not a placeholder: ${unexplained.join(', ')}`
        ).toEqual([]);
    });

    it.each(predicateModules())('%s routes its status through the normalizer', (moduleName) => {
        const liveCode = stripComments(readFileSync(resolve(PREDICATES_DIR, moduleName), 'utf-8'));

        expect(
            liveCode,
            `${moduleName} decides liveness from a status but never calls ${NORMALIZER}. ` +
                "`billing_subscriptions.status` holds qzpay vocabulary as well as Hospeda's " +
                '(`canceled`, `unpaid`, `incomplete`, `incomplete_expired`), so a raw comparison ' +
                'is blind to whichever spelling the last writer used — and it fails silently, ' +
                'returning false for a state that is live. That is the HOS-108 mechanism; ' +
                'HOS-1310 closed it for the three predicates that existed. Normalize first, ' +
                'or add the module to EXEMPT_MODULES with the reason it compares no status.'
        ).toMatch(new RegExp(`\\b${NORMALIZER}\\s*\\(`));
    });

    it('and the normalizer is imported from within the package, never re-declared', () => {
        /*
         * The map must have one home. A predicate that re-declared the qzpay
         * spellings locally would satisfy the assertion above and reintroduce the
         * duplication the move was done to avoid (HOS-108's mechanism is two
         * copies of a vocabulary, not the absence of one).
         */
        for (const moduleName of predicateModules()) {
            const liveCode = stripComments(
                readFileSync(resolve(PREDICATES_DIR, moduleName), 'utf-8')
            );
            if (!new RegExp(`\\b${NORMALIZER}\\s*\\(`).test(liveCode)) {
                continue;
            }
            expect(liveCode, `${moduleName} must IMPORT the normalizer, not define one`).toMatch(
                new RegExp(`import\\s*\\{[^}]*${NORMALIZER}[^}]*\\}\\s*from`)
            );
            expect(
                liveCode,
                `${moduleName} re-declares a qzpay spelling. The alias map lives in ` +
                    'subscription-status-normalize.ts and nowhere else.'
            ).not.toMatch(/['"]incomplete_expired['"]/);
        }
    });
});

/**
 * The two gates HOS-1310 names, and the predicate each resolves liveness through.
 * Two entries, deliberately — this is a pin on a known pair, not a scan.
 */
const VERTICAL_GATES = [
    {
        vertical: 'commerce (gastronomy + experience) listing visibility',
        file: 'packages/service-core/src/services/commerce/commerce-visibility.ts',
        predicate: 'isEntitlementGrantingStatus',
        notThisOne: 'isSubscriptionLive'
    },
    {
        vertical: 'accommodation publish eligibility',
        file: 'apps/api/src/services/accommodation-publish-deps.ts',
        predicate: 'isSubscriptionLive',
        notThisOne: 'isEntitlementGrantingStatus'
    }
] as const;

describe('HOS-1310 Part 2: the two vertical gates, pinned', () => {
    it.each(VERTICAL_GATES)('$vertical resolves liveness through $predicate', ({
        file,
        predicate,
        notThisOne
    }) => {
        const liveCode = stripComments(readFileSync(resolve(REPO_ROOT, file), 'utf-8'));

        expect(
            liveCode,
            `${file} no longer calls ${predicate}. If this is the HOS-1310 unification ` +
                'landing, that is a product decision and this guard is the place to record ' +
                `it: update both entries together, and say in the commit which criterion ` +
                'won and why an elapsed period does (or does not) still grant access.'
        ).toMatch(new RegExp(`\\b${predicate}\\s*\\(`));

        expect(
            liveCode,
            `${file} now calls ${notThisOne} as well. Calling both is how the two gates ` +
                'quietly converge on an unreviewed third answer — HOS-1275 composed them ' +
                'deliberately in ONE file and documented why at length; do the same here ' +
                'or unify them properly.'
        ).not.toMatch(new RegExp(`\\b${notThisOne}\\s*\\(`));
    });

    it('the two gates still use DIFFERENT predicates — the issue is open, not fixed', () => {
        // The single assertion that would go green the day HOS-1310 is closed.
        // Written as an inequality so closing the issue is a deliberate edit to
        // this file rather than something a reviewer has to notice.
        const [commerce, accommodation] = VERTICAL_GATES;
        expect(
            commerce.predicate,
            'If the two gates now agree, HOS-1310 is resolved: delete this assertion, update ' +
                'the table in packages/billing/src/predicates/index.ts, and remove the ' +
                '"open question" section from liveness-predicate-divergence.test.ts.'
        ).not.toBe(accommodation.predicate);
    });
});
