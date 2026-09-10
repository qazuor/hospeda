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
import { QZPAY_STORED_STATUS_ALIASES } from '../src/predicates/subscription-status-normalize.js';

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

/**
 * Every `.ts` module under `src/predicates`, RECURSIVELY, that is not explicitly
 * exempt. Paths are relative to that directory.
 *
 * Recursion is not hypothetical tidiness: the first cut used a flat
 * `readdirSync` + `.endsWith('.ts')`, which silently drops every directory
 * entry. A predicate added at `src/predicates/vertical/is-whatever.ts` simply did
 * not appear in the scanned list, and the guard reported a pass — the same
 * "checks less than it claims" shape as the name-shape rule this file already
 * replaced once.
 */
function predicateModules(): readonly string[] {
    const walk = (dir: string, prefix: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
            if (entry.isDirectory()) {
                return walk(resolve(dir, entry.name), rel);
            }
            return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [rel] : [];
        });

    return walk(PREDICATES_DIR, '')
        .filter((rel) => !EXEMPT_FILE_NAMES.has(rel))
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

        /*
         * Calling it is not using it. This was a real hole, reproduced by hand:
         *
         *     normalizeStoredSubscriptionStatus(status);
         *     return COVERED.has(status);
         *
         * satisfies the assertion above and compares the RAW value anyway. So the
         * result has to be BOUND to an identifier, and that identifier has to be
         * referenced again. The behavioural suite below is the real proof; this is
         * the cheap structural half that also covers a module whose exports the
         * prober cannot shape-match.
         */
        const binding = new RegExp(
            `(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${NORMALIZER}\\s*\\(`
        ).exec(liveCode);
        expect(
            binding,
            `${moduleName} calls ${NORMALIZER} without binding its result. Calling it and then ` +
                'comparing the raw status is the bug wearing the fix as a costume.'
        ).not.toBeNull();
        const boundName = binding?.[1] ?? '';
        const usesAfterBinding =
            new RegExp(`\\b${boundName}\\b`, 'g').exec(
                liveCode.slice((binding?.index ?? 0) + (binding?.[0]?.length ?? 0))
            ) !== null;
        expect(
            usesAfterBinding,
            `${moduleName} binds ${NORMALIZER}'s result to \`${boundName}\` and never reads it.`
        ).toBe(true);
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
 * Every exported function in the predicates barrel, probed for both call shapes
 * the directory actually uses: a bare status string, and an input object with a
 * `status` key. Derived from the module's own exports, so a fourth predicate is
 * probed without being added anywhere.
 */
async function probeablePredicates(): Promise<
    ReadonlyArray<{ readonly name: string; readonly call: (status: string) => boolean }>
> {
    const barrel = (await import('../src/predicates/index.js')) as Record<string, unknown>;
    const found: Array<{ name: string; call: (status: string) => boolean }> = [];

    for (const [name, value] of Object.entries(barrel)) {
        if (typeof value !== 'function') {
            continue;
        }
        const fn = value as (arg: unknown) => unknown;
        // Shape A: fn(status). Shape B: fn({ status }). Whichever returns a
        // boolean is the one this predicate speaks; a function that returns a
        // boolean for neither is not a status predicate and is skipped.
        const asString = (() => {
            try {
                return fn('active');
            } catch {
                return undefined;
            }
        })();
        if (typeof asString === 'boolean') {
            found.push({ name, call: (status) => fn(status) as boolean });
            continue;
        }
        const asObject = (() => {
            try {
                // `cancelAtPeriodEnd: true` so the cancelled branch is reachable —
                // HOS-1310 made it a requirement, and the point here is the
                // SPELLING, not the payment evidence.
                return fn({ status: 'active', cancelAtPeriodEnd: true });
            } catch {
                return undefined;
            }
        })();
        if (typeof asObject === 'boolean') {
            found.push({
                name,
                call: (status) => fn({ status, cancelAtPeriodEnd: true }) as boolean
            });
        }
    }

    return found;
}

describe('HOS-1310 Part 1b: BEHAVIOURAL — every predicate answers the alias like its twin', () => {
    /*
     * The assertions in Part 1 read source text. This reads answers, which is the
     * only thing that can tell a normalizer that DECIDES from one that is merely
     * called: the hand-planted
     *
     *     normalizeStoredSubscriptionStatus(status);
     *     return COVERED.has(status);
     *
     * passes a textual check and fails every case below.
     *
     * Both the predicate list and the alias list are derived — from the barrel's
     * own exports and from QZPAY_STORED_STATUS_ALIASES — so neither goes stale
     * when a fifth predicate or a ninth alias lands.
     */
    it('finds predicates to probe — the derived probe is not vacuous', async () => {
        const probes = await probeablePredicates();
        expect(probes.length).toBeGreaterThanOrEqual(3);
        expect(probes.map((probe) => probe.name).sort()).toEqual(
            expect.arrayContaining([
                'isEntitlementGrantingStatus',
                'isLiveSubscriptionStatus',
                'isSubscriptionLive'
            ])
        );
    });

    it('every probed predicate gives a qzpay alias its twin answer', async () => {
        const probes = await probeablePredicates();
        const aliases = Object.entries(QZPAY_STORED_STATUS_ALIASES);
        expect(aliases.length).toBeGreaterThan(0);

        const disagreements: string[] = [];
        for (const { name, call } of probes) {
            for (const [alias, hospedaStatus] of aliases) {
                if (call(alias) !== call(hospedaStatus)) {
                    disagreements.push(`${name}: '${alias}' !== '${hospedaStatus}'`);
                }
            }
        }

        expect(
            disagreements,
            'These predicates answer differently about ONE state depending on which layer ' +
                `wrote the row:\n${disagreements.map((d) => `  - ${d}`).join('\n')}\n\n` +
                'That is the HOS-108 mechanism. Route the status through ' +
                'normalizeStoredSubscriptionStatus and compare the RESULT — calling it and then ' +
                'comparing the raw value passes the source-level check in Part 1 and fails here.'
        ).toEqual([]);
    });

    it('and an unknown spelling is refused by all of them (fails closed)', async () => {
        const probes = await probeablePredicates();
        for (const { name, call } of probes) {
            expect(call('not-a-status'), `${name} accepted an unknown status`).toBe(false);
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
