/**
 * @file billing-status-gate-canonical-predicate.guard.test.ts
 * @description Static guard: every API-side billing gate that asks "is this
 * subscription live right now?" must route through the canonical
 * `isEntitlementGrantingStatus` / `ENTITLEMENT_GRANTING_STATUSES` export
 * (`@repo/billing`), never a hand-rolled subscription-status comparison.
 *
 * ## The defect class
 *
 * `subscriptions.find((sub) => sub.status === 'active' || sub.status ===
 * 'trialing')` silently drops `comp`. That single omission is HOS-238
 * (entitlements resolved against no plan), HOS-239 (`plan: null` for comped
 * subscribers), and HOS-594 (add-on sales dead in production for months) — the
 * same bug, shipped three times, in three different files.
 * `isEntitlementGrantingStatus` already resolves the correct set
 * (`active | trialing | comp`, see
 * `packages/billing/src/predicates/is-entitlement-granting-status.ts`) and had
 * its own passing tests the whole time; the bug was always call sites that
 * never migrated to it.
 *
 * ## Scope (HOS-702)
 *
 * HOS-594 deliberately scoped its version of this guard to the two files that
 * fix touched, explicitly listing the unmigrated remainder as out of scope.
 * HOS-702 audited that remainder — 64 raw literal comparisons across 41 files —
 * triaged out the legitimate ones (the `isSubscriptionLive` predicate itself,
 * newsletter subscription status, addon PURCHASE status, the remapped web-front
 * vocabulary, and management-only actions where `comp` is excluded on purpose
 * because a complimentary subscription has no MercadoPago preapproval to
 * cancel/pause/re-price), migrated the real ones, and widened the guard to the
 * billing zone that actually migrated. Files NOT in this list are either out of
 * this guard's scope by triage or, in the case of exhaustive status→label
 * mappers (`routes/host/protected/dashboard.ts`), files where enumerating every
 * status IS the definition.
 *
 * ## Why the anti-pattern check is shaped this way
 *
 * The defect class is "N call sites forgot to use the shared predicate", so the
 * assertion has to be over the SET of gate call sites, not over one call site's
 * runtime behaviour — a unit test for `addon.checkout.ts` alone would never
 * have caught the identical bug sitting in `addon-entitlement.service.ts`.
 *
 * The check below is deliberately NOT anchored on `===` or any other single
 * syntax form. A reviewer could just as easily reintroduce the bug as
 * `['active', 'trialing'].includes(sub.status)`, a `switch` with
 * `case 'active':` / `case 'trialing':`, or `new Set(['active',
 * 'trialing']).has(sub.status)` — all of which silently drop `comp` exactly
 * like the original bug, and NONE of which contain a `===` token. Instead, the
 * guard flags any file where the string literals `'active'` and `'trialing'`
 * (quoted, so prose in a comment doesn't trip it) appear within a short window
 * of each other — that co-occurrence IS the bug, regardless of which JS
 * construct expresses it, because it means someone reconstructed the
 * entitlement-granting set by hand instead of calling the predicate that
 * already encodes it correctly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../src');

/**
 * Files that decide subscription liveness for a billing gate, and how many
 * canonical-predicate references each must contain (one per historical
 * hand-rolled call site — HOS-594 for the add-on pair, HOS-702 for the rest).
 */
const BILLING_STATUS_GATE_FILES = [
    // HOS-594 (the original pair).
    { file: 'services/addon.checkout.ts', minCalls: 3 },
    { file: 'services/addon-entitlement.service.ts', minCalls: 3 },
    // HOS-702 (migrated in this change).
    { file: 'routes/billing/start-paid.ts', minCalls: 2 },
    { file: 'cron/jobs/addon-expiry.job.ts', minCalls: 2 },
    { file: 'services/usage-tracking.service.ts', minCalls: 1 },
    { file: 'services/trial.service.ts', minCalls: 3 },
    { file: 'services/partner-reconcile.service.ts', minCalls: 1 },
    { file: 'services/billing/subscription-domain-metadata.ts', minCalls: 1 },
    { file: 'routes/commerce/protected/start-subscription.ts', minCalls: 1 },
    // HOS-702 (already migrated before this change — pinned so they cannot regress).
    { file: 'routes/user/protected/entitlements.ts', minCalls: 1 },
    { file: 'routes/user/protected/subscription.ts', minCalls: 1 },
    { file: 'routes/user/protected/stats.ts', minCalls: 1 },
    { file: 'middlewares/owner-entitlement.ts', minCalls: 2 },
    { file: 'middlewares/commerce-entitlement.ts', minCalls: 1 },
    { file: 'services/commerce-subscription-attach.service.ts', minCalls: 1 }
] as const;

/**
 * Matches an actual use of the canonical export — either a predicate
 * invocation or a reference to the const set — not just a mention in a comment.
 */
const PREDICATE_USE = /(isEntitlementGrantingStatus\s*\(|ENTITLEMENT_GRANTING_STATUSES\b)/g;

/** Matches importing either canonical export from the canonical package. */
const PREDICATE_IMPORT =
    /(isEntitlementGrantingStatus|ENTITLEMENT_GRANTING_STATUSES)[\s\S]{0,200}?from\s+['"]@repo\/billing['"]/;

/**
 * How close two quoted status literals may sit before we treat their
 * co-occurrence as "someone re-implemented the entitlement-granting set by
 * hand". 200 chars comfortably spans a multi-line boolean expression,
 * `.includes([...])` call, `switch` block, or `Set` literal, while staying far
 * short of spanning two unrelated statements in these files.
 */
const PROXIMITY_WINDOW = 200;

/**
 * Strips block comments (including JSDoc) and `//` line comments before the
 * anti-pattern scan runs. Deliberate: the JSDoc/inline comments around a fix
 * like this one legitimately spell out both status literals together to explain
 * WHY (e.g. "the hand-rolled `['active', 'trialing']` pair used to miss
 * `comp`") — scanning comments would make this guard fail on its own
 * explanatory prose. Only literals in live code should trip it.
 *
 * Deliberately naive (no string-literal awareness): a `//` inside a quoted
 * string on the same line as real code would also get stripped from that point
 * onward. None of the guarded files contain a status literal that way, and a
 * false negative here just means "guard misses a rare case", not "guard flags
 * legitimate code" — an acceptable trade-off for a source-level scan.
 */
function stripComments(source: string): string {
    const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlockComments.replace(/\/\/.*$/gm, '');
}

/**
 * Returns true if the quoted literals `'active'`/`"active"` and
 * `'trialing'`/`"trialing"` both appear in live (non-comment) code, within
 * {@link PROXIMITY_WINDOW} characters of each other. Syntax-form agnostic by
 * construction: it does not care whether they are joined by `===`,
 * `.includes()`, a `switch`, or a `Set` — only that they co-occur, which is the
 * actual signature of the bug (reconstructing the entitlement-granting set by
 * hand instead of calling the canonical predicate).
 */
function hasHandRolledActiveTrialingPair(source: string): boolean {
    const liveCode = stripComments(source);
    const activePositions = [...liveCode.matchAll(/['"]active['"]/g)].map((m) => m.index ?? -1);
    const trialingPositions = [...liveCode.matchAll(/['"]trialing['"]/g)].map((m) => m.index ?? -1);

    for (const activeIndex of activePositions) {
        for (const trialingIndex of trialingPositions) {
            if (Math.abs(activeIndex - trialingIndex) <= PROXIMITY_WINDOW) {
                return true;
            }
        }
    }
    return false;
}

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

describe('HOS-702 guard: API billing status gates use the canonical entitlement predicate', () => {
    it.each(
        BILLING_STATUS_GATE_FILES.map((f) => f.file)
    )('%s imports the canonical entitlement-status export from @repo/billing', (file) => {
        const source = readSrc(file);
        expect(
            source,
            `${file} does not import isEntitlementGrantingStatus / ` +
                "ENTITLEMENT_GRANTING_STATUSES from '@repo/billing'. Subscription " +
                'liveness must be resolved via the canonical predicate ' +
                '(packages/billing/src/predicates/is-entitlement-granting-status.ts), ' +
                'never a hand-rolled subscription-status comparison (HOS-594 / HOS-702).'
        ).toMatch(PREDICATE_IMPORT);
    });

    it.each(
        BILLING_STATUS_GATE_FILES
    )('$file uses the canonical entitlement-status export at least $minCalls time(s)', ({
        file,
        minCalls
    }) => {
        const source = readSrc(file);
        const useCount = [...source.matchAll(PREDICATE_USE)].length;
        expect(
            useCount,
            `${file} uses the canonical entitlement-status export only ${useCount} ` +
                `time(s), expected at least ${minCalls}. Every hand-rolled status check ` +
                'in this file must route through it, not just be imported once elsewhere.'
        ).toBeGreaterThanOrEqual(minCalls);
    });

    it.each(
        BILLING_STATUS_GATE_FILES.map((f) => f.file)
    )('%s does not hand-roll the active/trialing pair (misses comp — HOS-594/HOS-702)', (file) => {
        const source = readSrc(file);
        expect(
            hasHandRolledActiveTrialingPair(source),
            `${file} contains the literal 'active' and 'trialing' string tokens close ` +
                'together, which is the signature of hand-rolling the entitlement-granting ' +
                "set — it silently drops 'comp' regardless of whether it is written as ===, " +
                '.includes(), a switch, or a Set (HOS-594 / HOS-702). Use ' +
                'isEntitlementGrantingStatus(sub.status) or ENTITLEMENT_GRANTING_STATUSES ' +
                'instead.'
        ).toBe(false);
    });
});
