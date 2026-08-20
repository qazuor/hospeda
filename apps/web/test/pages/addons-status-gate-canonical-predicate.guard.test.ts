/**
 * @file addons-status-gate-canonical-predicate.guard.test.ts
 * @description Static guard: the add-ons self-service page's UX-level
 * subscription gate must route through the canonical
 * `isEntitlementGrantingStatus` predicate (`@repo/billing`), never a
 * hand-rolled subscription-status list.
 *
 * HOS-594: `USABLE_SUBSCRIPTION_STATUSES = ['active', 'trial', 'trialing']`
 * silently omitted `comp` — the real gate lives server-side
 * (`addon.checkout.ts`, also fixed by HOS-594), but this page-level check
 * still hid the purchase UI from a comp subscriber whenever the backend
 * happened not to normalize their status first. Mirrors the API-side guard
 * (`apps/api/test/services/addon-status-gate-canonical-predicate.guard.test.ts`)
 * — same anti-pattern, same fix, different app.
 *
 * The anti-pattern check is deliberately NOT anchored on `.includes(` — a
 * reviewer could just as easily reintroduce the bug as a `switch`, a `Set`,
 * or a chain of `===` comparisons, none of which contain `.includes(`. The
 * guard instead flags any co-occurrence of the quoted literals `'active'`
 * and `'trialing'` within a short window, which is what a hand-rolled
 * entitlement-granting set looks like regardless of the JS construct used
 * to express it. The page's one deliberate, reviewed exception — accepting
 * the legacy `'trial'` value outside the predicate (see the inline comment
 * in the page) — does not trip this guard, since `'trial'` alone never
 * co-occurs with `'trialing'` in the fixed source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADDONS_PAGE = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/addons/index.astro');

/** Matches importing the predicate from the canonical package. */
const PREDICATE_IMPORT = /isEntitlementGrantingStatus[\s\S]{0,120}?from\s+['"]@repo\/billing['"]/;

/** Matches an actual invocation, not just a mention in an import/comment. */
const PREDICATE_CALL = /isEntitlementGrantingStatus\s*\(/;

/**
 * How close two quoted status literals may sit before their co-occurrence is
 * treated as a hand-rolled entitlement-granting set. See the identical
 * constant/rationale in the API-side sibling guard.
 */
const PROXIMITY_WINDOW = 200;

/**
 * Strips `/* *\/` block comments and `//` line comments before the
 * anti-pattern scan runs, for the same reason as the API-side sibling guard:
 * the explanatory comment around this exact fix legitimately spells out both
 * status literals together to document WHY, and scanning comments would make
 * the guard fail on its own prose. Deliberately naive (no string-literal
 * awareness) — see the sibling guard's fuller rationale.
 */
function stripComments(source: string): string {
    const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlockComments.replace(/\/\/.*$/gm, '');
}

/**
 * Syntax-form-agnostic: flags any file where the quoted literals `'active'`
 * and `'trialing'` appear in live (non-comment) code within
 * {@link PROXIMITY_WINDOW} characters of each other, regardless of whether
 * they are joined by `.includes()`, `===`, a `switch`, or a `Set`.
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

describe('HOS-594 guard: addons page status gate uses the canonical entitlement predicate', () => {
    const source = readFileSync(ADDONS_PAGE, 'utf8');

    it('imports isEntitlementGrantingStatus from @repo/billing', () => {
        expect(
            source,
            "The addons page does not import isEntitlementGrantingStatus from '@repo/billing'. " +
                'The subscription-usability check must route through the canonical predicate, never ' +
                'a hand-rolled status list (HOS-594).'
        ).toMatch(PREDICATE_IMPORT);
    });

    it('calls isEntitlementGrantingStatus', () => {
        expect(
            source,
            'The addons page imports isEntitlementGrantingStatus but never calls it — a leftover ' +
                'import alone does not satisfy this guard.'
        ).toMatch(PREDICATE_CALL);
    });

    it('does not hand-roll the active/trialing pair (misses comp — HOS-594)', () => {
        expect(
            hasHandRolledActiveTrialingPair(source),
            "The addons page contains the literal 'active' and 'trialing' string tokens close " +
                'together, which is the signature of hand-rolling the entitlement-granting set — it ' +
                "silently drops 'comp' regardless of whether it is written as .includes(), ===, a " +
                'switch, or a Set (HOS-594). Use isEntitlementGrantingStatus(subscription.status) ' +
                "instead (plus the page's own deliberate 'trial' exception, kept outside the " +
                'predicate on purpose).'
        ).toBe(false);
    });
});
