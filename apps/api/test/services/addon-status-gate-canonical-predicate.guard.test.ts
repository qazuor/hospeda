/**
 * @file addon-status-gate-canonical-predicate.guard.test.ts
 * @description Static guard: the add-on purchase eligibility gate (add-on
 * checkout create/confirm/re-verify and the add-on entitlement apply/remove
 * paths) must route through the canonical `isEntitlementGrantingStatus`
 * predicate (`@repo/billing`), never a hand-rolled subscription-status
 * comparison.
 *
 * HOS-594: `subscriptions.find((sub) => sub.status === 'active' ||
 * sub.status === 'trialing')` silently drops `comp` — every complimentary
 * subscription in production was blocked from purchasing an add-on because
 * `comp` is not `'active'`/`'trialing'`. `isEntitlementGrantingStatus`
 * already resolves the correct set (`active | trialing | comp`, see
 * `packages/billing/src/predicates/is-entitlement-granting-status.ts`) and
 * had its own passing tests the whole time — the bug was three call sites in
 * `addon.checkout.ts` and three in `addon-entitlement.service.ts` that never
 * migrated to it (this is the THIRD such pair in billing, alongside
 * `normalizeStoredSubscriptionStatus` and an earlier `isEntitlementGrantingStatus`
 * migration gap — see the root CLAUDE.md "Billing architecture quick
 * reference").
 *
 * ## Why a static guard, and why this shape
 *
 * The defect class is "N call sites forgot to use the shared predicate", so
 * the assertion has to be over the SET of gate call sites, not over one
 * call site's runtime behaviour — a unit test for `addon.checkout.ts` alone
 * would never have caught the identical bug sitting in
 * `addon-entitlement.service.ts`.
 *
 * The anti-pattern check below is deliberately NOT anchored on `===` or any
 * other single syntax form. A reviewer could just as easily reintroduce the
 * bug as `['active', 'trialing'].includes(sub.status)`, a `switch` with
 * `case 'active':` / `case 'trialing':`, or `new Set(['active',
 * 'trialing']).has(sub.status)` — all of which silently drop `comp` exactly
 * like the original bug, and NONE of which contain a `===` token. Instead,
 * the guard flags any file where the string literals `'active'` and
 * `'trialing'` (quoted, so prose in a comment doesn't trip it) appear within
 * a short window of each other — that co-occurrence IS the bug, regardless
 * of which JS construct expresses it, because it means someone reconstructed
 * the entitlement-granting set by hand instead of calling the predicate that
 * already encodes it correctly.
 *
 * ## Scope
 *
 * Scoped to the two files this fix actually touched — the add-on purchase
 * gate (`addon.checkout.ts`) and the add-on entitlement apply/remove gate
 * (`addon-entitlement.service.ts`). The identical anti-pattern also exists,
 * unmigrated, in several OTHER billing files outside the add-on purchase
 * path (e.g. `subscription-pause.ts`, `start-paid.ts`, `plan-change.ts`,
 * `trial.service.ts`, `commerce/protected/start-subscription.ts`) — those
 * are pre-existing, out of scope for HOS-594, and were deliberately left
 * untouched rather than being bundled into this fix. Widening this guard to
 * the whole billing zone would fail CI on files nobody reviewed as part of
 * this change; that is a separate, larger cleanup.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../src');

/**
 * Files that gate add-on purchase/entitlement eligibility on subscription
 * status, and how many `isEntitlementGrantingStatus(...)` invocations each
 * must contain (one per historical hand-rolled call site — HOS-594).
 */
const ADDON_STATUS_GATE_FILES = [
    { file: 'services/addon.checkout.ts', minCalls: 3 },
    { file: 'services/addon-entitlement.service.ts', minCalls: 3 }
] as const;

/** Matches an actual invocation, not just a mention in an import/comment. */
const PREDICATE_CALL = /isEntitlementGrantingStatus\s*\(/g;

/** Matches importing the predicate from the canonical package. */
const PREDICATE_IMPORT = /isEntitlementGrantingStatus[\s\S]{0,120}?from\s+['"]@repo\/billing['"]/;

/**
 * How close two quoted status literals may sit before we treat their
 * co-occurrence as "someone re-implemented the entitlement-granting set by
 * hand". 200 chars comfortably spans a multi-line boolean expression,
 * `.includes([...])` call, `switch` block, or `Set` literal, while staying
 * far short of spanning two unrelated statements in these files.
 */
const PROXIMITY_WINDOW = 200;

/**
 * Strips `/* *\/` block comments (including JSDoc) and `//` line comments
 * before the anti-pattern scan runs. Deliberate: the JSDoc/inline comments
 * around a fix like this one legitimately spell out both status literals
 * together to explain WHY (e.g. "the hand-rolled `['active', 'trialing']`
 * pair used to miss `comp`") — scanning comments would make this guard fail
 * on its own explanatory prose. Only literals in live code should trip it.
 *
 * Deliberately naive (no string-literal awareness): a `//` inside a quoted
 * string on the same line as real code would also get stripped from that
 * point onward. None of the guarded files contain a status literal that way,
 * and a false negative here just means "guard misses a rare case", not "guard
 * flags legitimate code" — an acceptable trade-off for a source-level scan.
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
 * `.includes()`, a `switch`, or a `Set` — only that they co-occur, which is
 * the actual signature of the bug (reconstructing the entitlement-granting
 * set by hand instead of calling the canonical predicate).
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

describe('HOS-594 guard: add-on status gate uses the canonical entitlement predicate', () => {
    it.each(
        ADDON_STATUS_GATE_FILES.map((f) => f.file)
    )('%s imports isEntitlementGrantingStatus from @repo/billing', (file) => {
        const source = readSrc(file);
        expect(
            source,
            `${file} does not import isEntitlementGrantingStatus from '@repo/billing'. ` +
                'Add-on purchase/entitlement eligibility must be resolved via the canonical ' +
                'predicate (packages/billing/src/predicates/is-entitlement-granting-status.ts), ' +
                'never a hand-rolled subscription-status comparison (HOS-594).'
        ).toMatch(PREDICATE_IMPORT);
    });

    it.each(
        ADDON_STATUS_GATE_FILES
    )('$file calls isEntitlementGrantingStatus at least $minCalls time(s)', ({
        file,
        minCalls
    }) => {
        const source = readSrc(file);
        const callCount = [...source.matchAll(PREDICATE_CALL)].length;
        expect(
            callCount,
            `${file} calls isEntitlementGrantingStatus only ${callCount} time(s), expected at ` +
                `least ${minCalls}. Every historical hand-rolled status check in this file must ` +
                'route through the predicate, not just be imported once elsewhere.'
        ).toBeGreaterThanOrEqual(minCalls);
    });

    it.each(
        ADDON_STATUS_GATE_FILES.map((f) => f.file)
    )('%s does not hand-roll the active/trialing pair (misses comp — HOS-594)', (file) => {
        const source = readSrc(file);
        expect(
            hasHandRolledActiveTrialingPair(source),
            `${file} contains the literal 'active' and 'trialing' string tokens close together, ` +
                'which is the signature of hand-rolling the entitlement-granting set — it silently ' +
                "drops 'comp' regardless of whether it is written as ===, .includes(), a switch, or " +
                'a Set (HOS-594). Use isEntitlementGrantingStatus(sub.status) instead.'
        ).toBe(false);
    });
});
